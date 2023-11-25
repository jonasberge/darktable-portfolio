# Darktable photography portfolio

Prototype for a system that generates a static portfolio website
from your local [Darktable](https://www.darktable.org/) library.
Allows you to manage which photos are added to the portfolio by tagging them within Darktable
and then generating the website with just a few commands,
without the need to export any photos by hand.

This is just a proof of concept.
The idea is to split it up into separate, more maintanable and reusable parts:
- Accessing the local Darktable database through a GraphQL API
- Using that API in a Vue.js application
which defines the frontend and generates a static version of the site

## Dependencies

```
$ yarn install
$ make ./venv
$ source venv/bin/activate
```

Don't forget to activate the virtual environment.

## Configuration

Copy the `config.sample.env` file to `config.env`
and update the configuration parameters to your liking.
Tag your photos with `PORTFOLIO_ROOT_TAG`
and a subtag, like `portfolio|index`
(if `PORTFOLIO_ROOT_TAG=portfolio`),
to make them appear on the site.

Since this is just a prototype, some things are hardcoded.
If subpages need different names, the HTML needs to be adapted.
Subpages can be created for different subtags
by adding the to `PORTFOLIO_GALLERY_TAGS`,
with format `<tag>:<title>`.

Image sizes have to be changed in the source code for now: `app/routes.py`

## Development

In two separate terminal windows:

```
$ make run-gulp-dev
$ make run-flask-dev
```

The first command watches the Typescript directory
and builds a single javascript bundle which will be served through Flask.
The second command starts the flask server in development mode.

## Updating the portfolio

You can add photos by tagging them with e.g.
`portfolio` and `portfolio|index`.
Reload the page and they should appear automatically.

## Generate static site

While the second command above is running (the Flask server),
run this make target to make a static snapshot of the current site:

```
$ make freeze-site
```

This uses `wget` to retrieve all assets and puts them into the `docs` directory,
which is used by GitHub Pages to serve static content.

## Test static export

Run this command to check and see if everything is fine with the static export.

```
$ make serve-docs
```
