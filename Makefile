
default: help

lint: lint-js

lint-js:
	gjslint --nojsdoc `admin/projectfiles | grep '.js$'`

check-notices:
	@admin/projectfiles | xargs admin/check-notice | sort

help:
	@echo 'make lint-js       -- runs the linter on js files'
	@echo 'make check-notices -- checks for copyright notices'

