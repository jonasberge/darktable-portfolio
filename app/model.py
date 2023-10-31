import re
import datetime
from collections import defaultdict
from os import path
from typing import Iterable
from pathlib import Path

from app import darktable
from app.darktable import Photo, Export
from app.config import config


"""
dt_exporter = darktable.Exporter(
    cli_bin=config['DARKTABLE_CLI_BIN'],
    config_dir=config['DARKTABLE_CONFIG_DIR'],
    out_ext=config['EXPORT_EXT'],
    filename_format=config['EXPORT_FILENAME_FORMAT'],
    format_options=list(filter(None, re.split(r'[,;\s]', config['EXPORT_FORMAT_OPTIONS']))),
    hq_resampling=config['EXPORT_HQ_RESAMPLING'],
    height=config['EXPORT_MAX_HEIGHT'],
    width=config['EXPORT_MAX_WIDTH'],
    xmp_changes=[darktable.xmp_remove_borders],
    debug=True,
)


class ExportAsset(Export):
    def __init__(self, photo: Photo, filepath: str):
        Export.__init__(self, photo=photo, filepath=filepath)

    @property
    def static_url(self):
        return str(Path(self.filepath).relative_to(STATIC_DIR))

    @classmethod
    def from_export(cls, export: Export):
        return cls(photo=export.photo, filepath=export.filepath)


def load_photos(subtag=None) -> set[Photo]:
    photos: set[Photo] = set()
    dt_library = darktable.DarktableLibrary(config['DARKTABLE_CONFIG_DIR'])
    for tag in dt_library.get_subtags(config['PORTFOLIO_ROOT_TAG']):
        if subtag is None or tag.name.endswith(subtag):
            photos.update(dt_library.get_tagged_photos(tag))

    visited = dict()
    for photo in photos:
        if photo.filepath in visited:
            other_version = visited[photo.filepath]
            if photo.version != other_version:
                raise RuntimeError(f'multiple versions of the same photo: {photo.filepath}')
        visited[photo.filepath] = photo.version

    dt_library.close()
    return photos


def export_photos(photos) -> set[ExportAsset]:
    export_assets = set()
    for photo in photos:
        export = dt_exporter.export_cached(photo, MEDIA_DIR)
        assert export.filepath is not None
        export_assets.add(ExportAsset.from_export(export))
    return export_assets


def organize_exports(exports: Iterable[ExportAsset]) -> list[ExportAsset]:
    ""organizes exports by datetime (ascending), then filmroll (descending)
    ""

    def date_key(export: ExportAsset):
        d = export.photo.datetime_taken
        return datetime.datetime(year=d.year, month=d.month, day=d.day)
    def filmroll_key(export: ExportAsset):
        return (path.basename(export.photo.film_roll.directory), -export.photo.position)
    def datetime_key(export: ExportAsset):
        return export.photo.datetime_taken
    sorted_exports = sorted(exports, key=datetime_key)
    # sorted_exports = sorted(sorted_exports, key=date_key, reverse=True)
    sorted_exports = sorted(sorted_exports, key=filmroll_key, reverse=True)
    return sorted_exports


def group_exports(exports: Iterable[ExportAsset]):
    "" groups exports by the average month of their filmroll
    ""

    filmroll_dates_minmax = dict()
    for export in exports:
        fr = export.photo.film_roll.id
        dt = export.photo.datetime_taken
        if fr in filmroll_dates_minmax:
            lo, hi = filmroll_dates_minmax[fr]
            filmroll_dates_minmax[fr] = (min(lo, dt), max(hi, dt))
        else:
            filmroll_dates_minmax[fr] = (dt, dt)

    filmroll_keys = dict()
    for fr, (lo, hi) in filmroll_dates_minmax.items():
        avg = lo + (hi - lo) / 2
        month = datetime.datetime(year=avg.year, month=avg.month, day=1)
        filmroll_keys[fr] = month

    grouped_exports = defaultdict(list)
    key_order = []
    for export in exports:
        key = filmroll_keys[export.photo.film_roll.id]
        if key not in grouped_exports:
            key_order.append(key)
        grouped_exports[key].append(export)

    return [(key, grouped_exports[key]) for key in key_order]

"""
