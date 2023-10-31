from os import path

from dotenv import load_dotenv, dotenv_values


load_dotenv()
config = dotenv_values('config.env')

STATIC_DIR = 'static'
STATIC_URL = 'static'
DEBUG_ENV = 'APP_DEBUG'
