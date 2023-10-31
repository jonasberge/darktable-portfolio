from os import path

from flask import Flask

from app.config import STATIC_DIR, STATIC_URL


app = Flask(
    __name__,
    static_folder=path.join('..', STATIC_DIR),
    static_url_path=f'/{STATIC_URL}',
    template_folder='../templates'
)

from app import routes
