.PHONY: all pip-freeze run-flask-dev run-gulp-dev freeze-site prepare-github-pages publish-github-pages serve-docs

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
	APP_DEBUG=1 flask --app app --debug run --without-threads --host=0.0.0.0 --port 5000

run-gulp-dev:
	yarn run gulp start

freeze-site:
	find docs ! -name 'docs' ! -name 'CNAME' -exec rm -rf {} +
	wget --no-check-certificate --no-cache --no-cookies -E -m -p -k -P docs http://127.0.0.1:5000
	mv docs/127.0.0.1:5000/* docs/
	rm -r docs/127.0.0.1:5000

serve-docs:
	python3 -m http.server -d docs 8000

prepare-github-pages:
	find docs -type f -name '*.html' -exec sed -i 's/href="index.html"/href="\/"/g' {} \;
	find docs -type f -name '*.html' -exec sed -i -E 's/href="(.*).html"/href="\1"/g' {} \;

publish-github-pages: prepare-github-pages
	git diff --exit-code docs || \
		git add docs && git commit -m "Publish" && git push origin master
