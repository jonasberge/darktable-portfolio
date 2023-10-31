.PHONY: all pip-freeze

VENV_DIR=venv
VENV_ACTIVATE=$(VENV_DIR)/bin/activate

all:

./$(VENV_DIR):
	python3 -m venv $(VENV_DIR)
	. $(VENV_ACTIVATE); \
		python3 -m pip install pip --upgrade; \
		python3 -m pip install -r requirements.txt

pip-freeze: ./$(VENV_DIR)
	. $(VENV_ACTIVATE); \
		pip freeze | tee requirements.txt

run-flask-dev:
	APP_DEBUG=1 flask --app app --debug run --without-threads --host=0.0.0.0

run-gulp-dev:
	yarn run gulp start
