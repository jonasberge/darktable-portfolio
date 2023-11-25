from collections import defaultdict
import datetime
import json
import os
import pathlib
import re
from os import path
from enum import Enum
import string
import sys
from typing import Any, Iterable

from flask import render_template, send_file, abort, request

from app import app, darktable
from app.config import DEBUG_ENV, STATIC_URL, config
# from app.model import load_photos, export_photos, organize_exports, group_exports


class Dimensions:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def aspect_ratio(self):
        if self.height == 0:
            return 0
        return float(self.width) / self.height


class MediaSize:
    SMALL = 'small'
    MEDIUM = 'medium'
    LARGE = 'large'
    DEFAULT = LARGE

    def __init__(self, name: str, dimensions: Dimensions):
        self.name = name
        self.dimensions = dimensions

    @property
    def lower_name(self):
        return self.name.lower()


class Struct:
    def __init__(self, **entries):
        self.__dict__.update(entries)


class FilenameFormat:
    """ Implements a Darktable format string for export filenames.
        Only supports a subset of variables as not all are used here.
    """

    class Placeholder:
        def __init__(self, values: list[str]):
            self.values = values

        def __getattr__(self, __name: str) -> Any:
            return FilenameFormat.Placeholder(self.values + [__name])

        def __repr__(self):
            return '.'.join(self.values).join('{}')

        def __str__(self):
            return repr(self)

    class Default(dict):
        def __missing__(self, key):
            if not key.isupper():
                raise KeyError(str(key))
            return FilenameFormat.Placeholder([key])

    def __init__(self, format_string):
        """ The format_string must be a python format string,
            where the variables from Darktable
            are transformed to python format string placeholders, e.g.:
            "$(FILE.NAME)" becomes "{FILE.NAME}".
            Not that all letters must remain uppercase.
            You can also add your own placeholders
            which will be replaced with values that are passed to render().
        """
        self.format_string = format_string

    def render(self, **kwargs):
        format_dict = FilenameFormat.Default(kwargs)
        result = string.Formatter().vformat(self.format_string, (), format_dict)
        # result = self.format_string.format_map(format_dict)
        result = re.sub(r'\{([A-Z\.]+)\}', r'$(\1)', result)
        return result


class MediaExporter(darktable.Exporter):
    """ Flask media exporter with arguments from the app's configuration
        and default values that make sense in the context of the app.
    """
    defaults = {
        'cli_bin': config['DARKTABLE_CLI_BIN'],
        'config_dir': config['DARKTABLE_CONFIG_DIR'],
        'out_ext': config['EXPORT_EXT'],
        'format_options': darktable.parse_format_options(config['EXPORT_FORMAT_OPTIONS']),
        'hq_resampling': config['EXPORT_HQ_RESAMPLING'],
        'xmp_changes': [darktable.xmp_remove_borders],
        'debug': os.getenv(DEBUG_ENV) == '1',
    }

    def __init__(self, **kwargs):
        arguments = self.defaults.copy()
        arguments.update(kwargs)
        super().__init__(**arguments)


class SampleExporter(MediaExporter):
    """ Exporter that exports small samples of photos,
        mainly to be able to determine a photo's export dimensions.
        Photos can e.g. have border's (which are removed by the exporter)
        and thus the export dimensions in the Darktable database are unreliable.
        Exporting a small, low-res sample is the only sensible solution
        with the least amount of work needed to implement.
    """
    def __init__(self):
        super().__init__(
            cache_key=self.__class__.__name__,
            out_ext='jpg',
            filename_format=FilenameFormat('{EXIF.YEAR}{EXIF.MONTH}{EXIF.DAY}{EXIF.HOUR}{EXIF.MINUTE}{EXIF.SECOND}-{FILE.NAME}').render(),
            format_options=darktable.parse_format_options('jpeg/quality=5'),
            hq_resampling='false',
            xmp_changes=[darktable.xmp_remove_borders],
            width=1920,
            height=1080,
            debug=True, # TODO: False
        )

    def get_sample_export(self, photo: darktable.Photo) -> darktable.Export:
        export_dir = os.path.join(config['EXPORT_DIR'], 'samples')
        return sample_exporter.export_cached(photo, export_dir)


class ExportManager:
    EXPORT_FILENAME_FORMAT = FilenameFormat('{media_size}/{EXIF.YEAR}{EXIF.MONTH}{EXIF.DAY}{EXIF.HOUR}{EXIF.MINUTE}{EXIF.SECOND}-{FILE.NAME}')

    def __init__(self):
        self.exporter_instances: dict[str, darktable.Exporter] = {}
        self.media_sizes: dict[str, MediaSize] = {}

    def register_media_size(self, media_size: MediaSize):
        self.media_sizes[media_size.lower_name] = media_size

    def has_media_size(self, media_size_name: str):
        return media_size_name.lower() in self.media_sizes

    def get_media_size(self, media_size_name: str):
        if not self.has_media_size(media_size_name):
            raise RuntimeError(f'unknown media size name: {media_size_name}')
        return self.media_sizes[media_size_name.lower()]

    def get_exporter_instance(self, media_size_name: str):
        key = media_size_name.lower()
        if key not in self.media_sizes:
            raise RuntimeError(f'media size is not registered: {key}')
        media_size = self.media_sizes[key]
        if media_size.lower_name in self.exporter_instances:
            return self.exporter_instances[media_size.lower_name]
        exporter_instance = self.create_darktable_exporter(media_size)
        self.exporter_instances[media_size.lower_name] = exporter_instance
        return exporter_instance

    def create_darktable_exporter(self, media_size: MediaSize):
        format_string = self.EXPORT_FILENAME_FORMAT.render(media_size=media_size.lower_name)
        return MediaExporter(
            cache_key=media_size.lower_name,
            filename_format=format_string,
            width=media_size.dimensions.width,
            height=media_size.dimensions.height,
        )


export_manager = ExportManager()
# export_manager.register_media_size(MediaSize(MediaSize.LARGE, Dimensions(width=2560, height=1440)))
# export_manager.register_media_size(MediaSize(MediaSize.LARGE, Dimensions(width=1920, height=1280)))
# export_manager.register_media_size(MediaSize(MediaSize.MEDIUM, Dimensions(width=1592, height=896)))
export_manager.register_media_size(MediaSize(MediaSize.LARGE, Dimensions(width=1728, height=972)))
export_manager.register_media_size(MediaSize(MediaSize.MEDIUM, Dimensions(width=1080, height=972)))
export_manager.register_media_size(MediaSize(MediaSize.SMALL, Dimensions(width=256, height=256)))

sample_exporter = SampleExporter()

portfolio_galleries = {
    tag: display_name
    for tag, display_name in [
        gallery.split(':')
        for gallery in config['PORTFOLIO_GALLERY_TAGS'].split(',')
    ]
}


def get_darktable_library() -> darktable.DarktableLibrary:
    return darktable.DarktableLibrary(config['DARKTABLE_CONFIG_DIR'])


# def get_exports(subtag=None):
#     return organize_exports(export_photos(load_photos(subtag=subtag)))


# def get_grouped_exports(subtag=None):
#     exports = get_exports(subtag)
#     grouped_exports = group_exports(exports)
#     return grouped_exports


class MediaUrl:
    format = '/media/{media_size}/{id}/{file_basename}.{file_extension}'

    @classmethod
    def render(cls, **kwargs):
        return cls.format.format(**kwargs)


class PhotoAsset:
    def __init__(self, photo: darktable.Photo, aspect_ratio: float, date_key: datetime.datetime):
        self.photo: darktable.Photo = photo
        self.aspect_ratio: float = aspect_ratio
        self.date_key: datetime.datetime = date_key

    def get_url(self, media_size: str = MediaSize.DEFAULT):
        return MediaUrl.render(
            media_size=media_size.lower(),
            id=str(self.photo.id),
            file_basename=path.splitext(path.basename(self.photo.filepath))[0],
            file_extension=config['EXPORT_EXT']
        ).removeprefix('/')

    def dimensions_for_media_size(self, media_size: MediaSize):
        calculated_width = media_size.dimensions.height * self.aspect_ratio
        calculated_height = media_size.dimensions.width / self.aspect_ratio
        if calculated_width <= media_size.dimensions.width:
            return Dimensions(calculated_width, media_size.dimensions.height)
        if calculated_height <= media_size.dimensions.width:
            return Dimensions(media_size.dimensions.width, calculated_height)
        raise RuntimeError('dont know what to do')


def get_portfolio_photos(sub_tag: str = None, include_root_tag=False) -> list[darktable.Photo]:
    photos: list[darktable.Photo] = list()
    with get_darktable_library() as lib:
        for tag in lib.get_subtags(config['PORTFOLIO_ROOT_TAG'], including_tag=include_root_tag):
            tag_path = tag.name.split('|')
            if sub_tag is None or len(tag_path) == 2 and tag_path[1] == sub_tag:
                photos.extend(lib.get_tagged_photos(tag))
    return photos


def filmroll_average_dates(photos: list[darktable.Photo]) -> dict[int, datetime.datetime]:
    """ Determines the average datetime for each film roll,
        given a subset of the photos in that film roll.
        Returns a dictionary mapping the film roll id to the average date.
    """
    # determine the minimum and maximum date in each film roll
    filmroll_dates_minmax = dict()
    for photo in photos:
        fr = photo.film_roll.id
        dt = photo.datetime_taken
        if fr in filmroll_dates_minmax:
            lo, hi = filmroll_dates_minmax[fr]
            filmroll_dates_minmax[fr] = (min(lo, dt), max(hi, dt))
        else:
            filmroll_dates_minmax[fr] = (dt, dt)

    # determine the average
    filmroll_keys = dict()
    for fr, (lo, hi) in filmroll_dates_minmax.items():
        avg = lo + (hi - lo) / 2
        filmroll_keys[fr] = avg

    return filmroll_keys


def create_photo_assets(photos: list[darktable.Photo]) -> list[darktable.Photo]:
    filmroll_dates = filmroll_average_dates(photos)
    media_assets: list[PhotoAsset] = []

    for photo in photos:
        filmroll_date = filmroll_dates[photo.film_roll.id]
        export = sample_exporter.get_sample_export(photo)
        media_assets.append(PhotoAsset(photo, export.aspect_ratio, filmroll_date))

    return media_assets


def sorted_photo_assets(photo_assets: list[PhotoAsset]) -> list[PhotoAsset]:
    def filmroll_key(photo_asset: PhotoAsset):
        return photo_asset.date_key
    def datetime_key(photo_asset: PhotoAsset):
        return photo_asset.photo.datetime_taken
    sorted_assets = sorted(photo_assets, key=datetime_key)
    sorted_assets = sorted(sorted_assets, key=filmroll_key, reverse=True)
    return sorted_assets


def get_gallery_photos(gallery_tag: str) -> list[darktable.Photo]:
    photos = get_portfolio_photos(gallery_tag)
    photo_assets = create_photo_assets(photos)
    photo_assets = sorted_photo_assets(photo_assets)
    return photo_assets


@app.route(MediaUrl.render(
    media_size='<string:media_size>',
    id='<int:id>',
    file_basename='<string:file_basename>',
    file_extension='<string:file_extension>'
))
def media(media_size: str, id: int, file_basename: str, file_extension: str):
    """ Request a photo export from the database by id and the file's basename
        (without raw file extension) as an export with the specified extension.
        the extension must be the same as the one configured in config.env.
        the image is updated if the XMP or export parameters change,
        otherwise the cached export is returned for fast access.
    """

    if file_extension.lower() != config['EXPORT_EXT'].lower():
        raise RuntimeError('media file extension is not the configured extension')
    media_size = media_size.lower()
    if not export_manager.has_media_size(media_size):
        raise RuntimeError('unsupported media size')
    exporter = export_manager.get_exporter_instance(media_size)
    with get_darktable_library() as lib:
        # only include portfolio photos, not others
        portfolio_tag = lib.get_tag(config['PORTFOLIO_ROOT_TAG'])
        photo = lib.get_photo_by_id_basename_tag(id=id, file_basename=file_basename, tag=portfolio_tag)
    if photo is None:
        abort(404)
    photo_export = exporter.export_cached(photo, out_dir=config['EXPORT_DIR'])
    if photo is None:
        raise RuntimeError('export is empty')
    return send_file(
        path_or_file=path.join(os.getcwd(), photo_export.filepath),
        download_name=f'{file_basename}.{os.path.splitext(photo_export.filepath)[1]}'
    )


@app.route("/")
def index():
    return gallery(config['PORTFOLIO_INDEX_GALLERY'])


@app.route("/<string:gallery>")
def gallery(gallery: str):
    """ Renders a gallery for the given gallery name (i.e. portfolio subtag).
    """
    gallery = gallery.lower()
    if gallery not in portfolio_galleries:
        abort(404)
    display_name = portfolio_galleries[gallery]
    return render_template(
        'gallery.jinja',
        title=display_name,
        menu_item=gallery,
        photo_assets=get_gallery_photos(gallery),
        export_manager=export_manager
    )


@app.route("/about")
def contact():
    return render_template(
        'about.jinja',
        title='About'
    )



@app.before_request
def check_duplicates():
    # TODO
    # 1. check if those photos tagged 'portfolio' only use 1 version of their photo.
    #
    if not request.endpoint or request.endpoint.startswith(STATIC_URL):
        return
    media_url = str(pathlib.Path(*pathlib.Path(MediaUrl.format).parts[:2]))
    if request.endpoint.startswith(media_url):
        return
    if os.getenv(DEBUG_ENV) == '1':
        print('checking if photos have multiple versions')
    photos = get_portfolio_photos(include_root_tag=True)
    visited = dict()
    for photo in photos:
        if photo.filepath in visited:
            other_version = visited[photo.filepath]
            if photo.version != other_version:
                raise RuntimeError(f'multiple versions of the same photo: {photo.filepath}')
        visited[photo.filepath] = photo.version
