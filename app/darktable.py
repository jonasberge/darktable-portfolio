import re
import os
import subprocess
import tempfile
import datetime
import sqlite3
from dateutil.relativedelta import relativedelta
from pathlib import Path
from collections import defaultdict
from xml.etree import ElementTree
from xml.etree.ElementTree import Element
from io import TextIOWrapper
from os import path
from typing import Callable
from PIL import Image

from app.util import Cache, filehash, readonly_sqlite_connection, fullname
from app.vendor.args_hash import args_hash


MODULE_DIR = path.abspath(path.dirname(__file__))
CACHE_FILENAME = os.path.splitext(__file__)[0] + '.cache.pkl'


Position = int


class HasId:
    id: int

    def __hash__(self):
        return self.id

    def __eq__(self, other):
        return self.id == other.id


class FilmRoll(HasId):
    def __init__(self, id, directory):
        self.id = id
        self.directory = directory

    def __repr__(self):
        return f'{self.__class__.__name__}({self.id}, {self.directory})'


class Tag(HasId):
    def __init__(self, id, name):
        self.id = id
        self.name = name

    def __repr__(self):
        return f'{self.__class__.__name__}({self.id}, {self.name})'


class Photo(HasId):
    def __init__(self, id, filepath, version, datetime_taken: datetime.datetime,
                 tags: dict[Tag, Position], film_roll: FilmRoll, position: Position):
        self.id: int = id
        self.filepath: str = filepath
        self.version: int = version
        self.datetime_taken: datetime.datetime = datetime_taken
        self.tags: dict[Tag, Position] = tags
        self.film_roll: FilmRoll = film_roll
        self.position: Position = position

    @property
    def xmp_path(self):
        filename = path.basename(self.filepath)
        filename, ext = path.splitext(filename)
        if self.version > 0:
            filename += '_' + f'{self.version:02}'
        xmp_path = filename + ext + '.' + 'xmp'
        return path.join(path.dirname(self.filepath), xmp_path)

    def __repr__(self):
        return self.__class__.__name__ + '(' + \
            ", ".join([
                repr(self.id),
                repr(self.filepath),
                repr(self.version),
                repr(self.datetime_taken),
                repr(self.tags),
                repr(self.film_roll),
                repr(self.position),
            ]) + ')'


def parse_format_options(options_list: str):
    return list(filter(None, re.split(r'[,;\s]', options_list)))


class Export:
    def __init__(self, photo: Photo, filepath: str):
        self.photo: Photo = photo
        self.filepath: str = filepath

    @property
    def filepath(self):
        return self._filepath

    @filepath.setter
    def filepath(self, value):
        self._filepath = value
        self._width = None
        self._height = None

    @property
    def width(self):
        if self._width is None:
            self._read_export_attributes()
        return self._width

    @property
    def height(self):
        if self._height is None:
            self._read_export_attributes()
        return self._height

    @property
    def aspect_ratio(self):
        return float(self.width) / self.height

    def _read_export_attributes(self):
        with Image.open(self.filepath) as image:
            self._width, self._height = image.size

    def __repr__(self):
        return f'Export({self.filepath}, {self.photo})'


class Exporter:
    def __init__(self, *, cache_key, cli_bin, config_dir, filename_format,
                 out_ext, format_options, hq_resampling, width, height,
                 debug=False, xmp_changes=[]):
        self.cli_bin = cli_bin
        self.config_dir = config_dir
        self.filename_format = filename_format
        self.out_ext = out_ext
        self.format_options = format_options
        self.hq_resampling = hq_resampling
        self.width = width
        self.height = height
        self.debug = debug
        self.xmp_changes = xmp_changes
        _, self.tmp_xmp_name = tempfile.mkstemp(suffix='.xmp')

        self.args_hash = args_hash(
            cli_bin=str(cli_bin),
            config_dir=str(config_dir),
            filename_format=str(filename_format),
            out_ext=str(out_ext),
            format_options=str(format_options),
            hq_resampling=str(hq_resampling),
            width=str(width),
            height=str(height),
            xmp_changes=str([fullname(func) for func in xmp_changes])
        )
        self.cache = Cache(path.join(MODULE_DIR, CACHE_FILENAME), prefix=f'{cache_key}:main:')
        self.cache_xmp_hashes = Cache(path.join(MODULE_DIR, CACHE_FILENAME), prefix=f'{cache_key}:xmp:')
        self.cache_exported = Cache(path.join(MODULE_DIR, CACHE_FILENAME), prefix=f'{cache_key}:export:')
        if self.args_hash != self.cache.load('args_hash'):
            self.cache_exported.prune()
            self.cache_xmp_hashes.prune()
        self.cache.save('args_hash', self.args_hash)

        self._sess_exported = set()

    def __del__(self):
        os.unlink(self.tmp_xmp_name)

    def export_cached(self, photo: Photo, out_dir: str) -> Export:
        """ Exports a photo to a directory through Darktable's CLI interface,
            but only if there are changes to the XMP
            or it hasn't been exported yet.
            Returns a copy of the photo instance where export_filepath is set.
        """

        # TODO hash the class instead and return this identifier
        cache_key = f'{photo.filepath}:{photo.version}'

        xmp_hash = filehash(photo.xmp_path)
        export_filepath = self.cache_exported.load(cache_key)
        if export_filepath is not None and path.exists(export_filepath):
            self._sess_exported.add(export_filepath)
            if xmp_hash == self.cache_xmp_hashes.load(cache_key):
                return Export(photo, filepath=export_filepath)

        export = self.export(photo, out_dir=out_dir)

        self.cache_xmp_hashes.save(cache_key, xmp_hash)
        self.cache_exported.save(cache_key, export.filepath)

        return export

    def export(self, photo: Photo, out_dir: str) -> Export:
        """ Exports a photo to a directory through Darktable's CLI interface.
            Returns a copy of the photo instance where export_filepath is set.
        """

        xmp_path = photo.xmp_path

        if len(self.xmp_changes) > 0:
            with open(self.tmp_xmp_name, 'w') as tmp_xmp_file:
                modify_xmp(xmp_path, tmp_xmp_file, changes=self.xmp_changes)
            xmp_path = self.tmp_xmp_name

        out_path = path.join(out_dir, self.filename_format)
        # https://docs.darktable.org/usermanual/4.0/en/special-topics/program-invocation/darktable-cli
        # https://docs.darktable.org/usermanual/4.0/en/special-topics/program-invocation/darktable
        command = [
            self.cli_bin,
            photo.filepath,
            xmp_path,
            out_path,
            f'--width', str(self.width),
            f'--height', str(self.height),
            f'--out-ext', self.out_ext,
            f'--hq', self.hq_resampling,
            f'--upscale', 'false',
            f'--apply-custom-presets', 'false',
            f'--core', # everything after this are darktable core parameters
            f'--configdir', self.config_dir,
        ]
        for option in self.format_options:
            command.append('--conf')
            command.append(f'plugins/imageio/format/{option}')

        if self.debug:
            print('xmp:', photo.xmp_path)
            print(' '.join([f"'{word}'" for word in command]))

        result = subprocess.run(command, capture_output=True, text=True)
        if self.debug:
            print(result.stdout.rstrip())

        # extract the exported filename
        match = re.search(r'exported to `([^\']+)\'', result.stdout)
        if not match:
            raise RuntimeError('expected darktable-cli output to contain filename')

        export_filepath = match.groups()[0]
        self._sess_exported.add(export_filepath)

        # remove exif data
        image = Image.open(export_filepath)
        data = list(image.getdata())
        image_noexif = Image.new(image.mode, image.size)
        image_noexif.putdata(data)
        image_noexif.save(export_filepath)
        image_noexif.close()

        return Export(photo, filepath=export_filepath)

    def sync(self, directory):
        """ Removes all files in the given directory, except:
            - Files that have been exported during this session and
            - Files that would have been exported but already existed.
            The current session starts at object creation
            and is reset (cleared) whenever sync() is called.
        """
        for filepath_obj in Path(directory).glob('**/*'):
            filepath = str(filepath_obj)
            if filepath_obj.is_file() and filepath not in self._sess_exported:
                if not is_raw_photo_ext(path.splitext(filepath)[1]):
                    # Remove all data associated with the photo from the cache
                    # and delete the exported photo from the directory.
                    for cache_key in self.cache_exported.keys(has_value=filepath):
                        print(f'Removed from portfolio: {cache_key}')
                        self.cache_exported.delete(cache_key)
                        self.cache_xmp_hashes.delete(cache_key)
                    try:
                        os.remove(filepath)
                    except Exception:
                        pass

        self._sess_exported.clear()


def parse_darktable_datetime(datetime_taken):
    dt = datetime.datetime.utcfromtimestamp(datetime_taken/1000/1000%100000000000)
    return dt - relativedelta(years=1969) + relativedelta(days=1)


class AttachedDatabase:
    def __init__(self, cursor: sqlite3.Cursor, name, db_path):
        self.cursor = cursor
        self.name = name
        self.db_path = db_path
        self.cursor.execute("""--sql
            ATTACH DATABASE ? AS ?;
        """, (self.db_path, self.name))

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cursor.execute("""--sql
            DETACH ?;
        """, (self.name,))


class DarktableLibrary:
    DATA_DB = 'data.db'
    LIBRARY_DB = 'library.db'

    def __init__(self, config_dir):
        self.config_dir = config_dir
        self.data_dbpath = path.join(config_dir, self.DATA_DB)
        self.library_dbpath = path.join(config_dir, self.LIBRARY_DB)
        self.data_conn = readonly_sqlite_connection(self.data_dbpath)
        self.library_conn = readonly_sqlite_connection(self.library_dbpath)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def __del__(self):
        self.close()

    def close(self):
        self.data_conn.close()
        self.library_conn.close()

    def _row_to_photo(self, row: sqlite3.Row, tag_separator: str) -> Photo:
        return Photo(
            id=int(row['id']),
            filepath=row['filepath'],
            version=int(row['version']),
            datetime_taken=parse_darktable_datetime(row['datetime_taken']),
            tags={
                Tag(int(tag_id), tag_name): int(tag_position)
                for tag_id, tag_name, tag_position in zip(
                    row['tag_ids'].split(tag_separator),
                    row['tag_names'].split(tag_separator),
                    row['tag_positions'].split(tag_separator)
                )
            },
            film_roll=FilmRoll(int(row['film_id']), row['film_directory']),
            position=int(row['film_position'])
        )

    def _select_photos(self, where_clause: str, args: tuple, limit: int = None) -> list[Photo]:
        cur = self.library_conn.cursor()
        separator = '#~~~#'
        with AttachedDatabase(cur, 'data', self.data_dbpath):
            cur.execute(f"""--sql
                SELECT
                    images.id,
                    rtrim(film_rolls.folder, '/') || '/' || images.filename AS filepath,
                    images.version,
                    images.datetime_taken,
                    film_rolls.id AS film_id,
                    film_rolls.folder AS film_directory,
                    images.position AS film_position,
                    GROUP_CONCAT(_tagged_images_2.tagid, ?) AS tag_ids,
                    GROUP_CONCAT(data.tags.name, ?) AS tag_names,
                    GROUP_CONCAT(_tagged_images_2.position, ?) AS tag_positions
                FROM tagged_images
                INNER JOIN images ON tagged_images.imgid = images.id
                INNER JOIN film_rolls ON film_rolls.id = images.film_id
                INNER JOIN tagged_images _tagged_images_2 ON images.id = _tagged_images_2.imgid
                INNER JOIN data.tags ON _tagged_images_2.tagid = data.tags.id
                {where_clause}
                GROUP BY images.id
                {f'LIMIT {limit}' if limit is not None and limit >= 0 else ''}
            """, (separator, separator, separator) + args)
            result = cur.fetchall()
            return [
                self._row_to_photo(row, tag_separator=separator)
                for row in result
            ]

    def get_photo_by_id_basename_tag(self, id: int, file_basename: str, tag: Tag) -> Photo:
        photos = self._select_photos("""--sql
            WHERE images.id = ? AND images.filename LIKE ? || '._%' AND tagged_images.tagid=?
        """, (id, file_basename, tag.id), limit=1)
        return photos[0] if len(photos) > 0 else None

    def get_tag(self, tag_name) -> Tag:
        cur = self.data_conn.cursor()
        cur.execute("""--sql
            SELECT id, name
            FROM tags
            WHERE name=?
            LIMIT 1
        """, (tag_name,))
        id, name = cur.fetchone()
        return Tag(int(id), name)

    def get_tagged_photos(self, tag: Tag) -> list[Photo]:
        return self._select_photos("""--sql
            WHERE tagged_images.tagid=? AND LOWER(data.tags.name) NOT LIKE 'darktable%'
        """, (tag.id,))

        """
        cur = self.library_conn.cursor()
        separator = '#~~~#'
        with AttachedDatabase(cur, 'data', self.data_dbpath):
            cur.execute(""--sql
                SELECT
                    i.id,
                    rtrim(fr.folder, '/') || '/' || i.filename AS filepath,
                    i.version,
                    i.datetime_taken,
                    fr.id AS film_id,
                    fr.folder AS film_directory,
                    i.position AS film_position,
                    GROUP_CONCAT(ti2.tagid, ?) AS tag_ids,
                    GROUP_CONCAT(d_t.name, ?) AS tag_names,
                    GROUP_CONCAT(ti2.position, ?) AS tag_positions
                FROM tagged_images ti
                INNER JOIN images i ON ti.imgid = i.id
                INNER JOIN film_rolls fr ON fr.id = i.film_id
                INNER JOIN tagged_images ti2 ON i.id = ti2.imgid
                INNER JOIN data.tags d_t ON ti2.tagid = d_t.id
                WHERE ti.tagid=? AND LOWER(d_t.name) NOT LIKE 'darktable%'
                GROUP BY i.id
            "", (separator, separator, separator, tag.id,))
            result = cur.fetchall()

        return [
            Photo(
                id=int(id),
                filepath=filepath,
                version=int(version),
                datetime_taken=parse_darktable_datetime(datetime_taken),
                tags={
                    Tag(int(tag_id), tag_name): int(tag_position)
                    for tag_id, tag_name, tag_position in zip(
                        tag_ids.split(separator),
                        tag_names.split(separator),
                        tag_positions.split(separator)
                    )
                },
                film_roll=FilmRoll(int(film_id), film_directory),
                position=int(film_position)
            )
            for id, filepath, version, datetime_taken,
            film_id, film_directory, film_position,
            tag_ids, tag_names, tag_positions in result
        ]
        """

    def get_subtags(self, tag_name, including_tag=False) -> list[Tag]:
        """ Returns all tag names and their tag ID
            that are underneath the given tag name in the hierarchy.
            E.g. tag_name="foo" yields "bar" for "foo|bar",
            but not "foo" if a tag is named "foo" only.
        """
        cur = self.data_conn.cursor()
        cur.execute(f"""--sql
            SELECT id, name
            FROM tags
            WHERE name LIKE ? || '|_%' {'OR name = ?' if including_tag else ''}
        """, (tag_name,) + ((tag_name,) if including_tag else ()))
        return [Tag(int(id), name) for id, name in cur.fetchall()]

    def get_photos_under_tag(self, tag_name) -> dict[Tag, list[Photo]]:
        """ Returns a dictionary of photos that are under the given tag
            in the hierarchy. The key is the subtag's name and the value
            is a tuple of the full path to the photo and its version number.
            e.g. tag_name="foo" yields "bar"->("/img.raw", 0)
            if that photo is tagged "foo|bar" in Darktable.
        """
        result = defaultdict(list)
        for tag in self.get_subtags(tag_name):
            for photo in self.get_tagged_photos(tag):
                result[tag].append(photo)
        return result


def modify_xmp(in_filename, out_fd: TextIOWrapper, changes: list[Callable[[Element, dict], None]]):
    # register all namespaces
    namespaces = dict([node for _, node in ElementTree.iterparse(in_filename, events=['start-ns'])])
    for name, uri in namespaces.items():
        ElementTree.register_namespace(name, uri)
    # parse xmp file
    tree = ElementTree.parse(in_filename)
    root = tree.getroot()
    # go through all "changers" which modify the xmp
    for func in changes:
        func(root, namespaces)
    # write output
    xmp_data = ElementTree.tostring(root, encoding='unicode')
    out_fd.seek(0)
    out_fd.truncate()
    out_fd.write(str(xmp_data))
    out_fd.flush()


def xmp_remove_borders(xmp_root, namespaces):
    for parent in xmp_root.findall('.//darktable:history//rdf:Seq', namespaces):
        for element in parent.findall('rdf:li[@darktable:operation="borders"]', namespaces):
            key = f'{{{namespaces["darktable"]}}}enabled'
            if key in element.attrib:
                element.attrib[key] = '0'


def sanitize_xmp(in_filename, out_fd: TextIOWrapper):
    modify_xmp(in_filename, out_fd, changes=[
        xmp_remove_borders
    ])


def is_raw_photo_ext(ext):
    # all raw image file extensions
    # (excluding darktable export extensions, namely tif)
    # https://en.wikipedia.org/wiki/Raw_image_format
    # https://docs.darktable.org/usermanual/4.0/en/special-topics/program-invocation/darktable-cli/
    return ext.lower() in set([
        '.3fr', '.ari', '.arw', '.bay', '.braw', '.crw', '.cr2', '.cr3',
        '.cap', '.data', '.dcs', '.dcr', '.dng', '.drf', '.eip', '.erf',
        '.fff', '.gpr', '.iiq', '.k25', '.kdc', '.mdc', '.mef', '.mos',
        '.mrw', '.nef', '.nrw', '.obm', '.orf', '.pef', '.ptx', '.pxn',
        '.r3d', '.raf', '.raw', '.rwl', '.rw2', '.rwz', '.sr2', '.srf',
        '.srw', '.tif', '.x3f'
    ]) - set(['.tif'])
