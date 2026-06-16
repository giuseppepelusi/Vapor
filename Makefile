VENV = .venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
DB = db.sqlite3
MEDIA = media
SEED = .seed

run:
	$(PYTHON) manage.py runserver

setup: clean
	python -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	$(PYTHON) manage.py makemigrations
	$(PYTHON) manage.py migrate
	DJANGO_SUPERUSER_PASSWORD=admin $(PYTHON) manage.py createsuperuser --noinput --username admin --email admin@email.com

dsave:
	mkdir -p $(SEED)
	cp $(DB) $(SEED)/
	rm -rf $(SEED)/$(MEDIA)
	if [ -d "$(MEDIA)" ]; then cp -r $(MEDIA) $(SEED)/; fi

dload: setup
	cp $(SEED)/$(DB) .
	rm -rf $(MEDIA)
	if [ -d "$(SEED)/$(MEDIA)" ]; then cp -r $(SEED)/$(MEDIA) .; fi

test:
	$(PYTHON) manage.py test

clean:
	rm -rf $(VENV)
	rm -f $(DB)
	rm -rf $(MEDIA)
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -path "./$(VENV)" -prune -o -path "*/migrations/0*.py" -exec rm -f {} +

.PHONY: run setup dsave dload test clean
.SILENT: run setup dsave dload test clean
