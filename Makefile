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
	$(PYTHON) manage.py shell -c "from django.contrib.auth import get_user_model; User=get_user_model(); u, _ = User.objects.get_or_create(username='admin', defaults={'is_staff':True, 'is_superuser':True}); u.set_password('admin'); u.save()"

dsave:
	mkdir -p $(SEED)
	cp $(DB) $(SEED)/
	rm -rf $(SEED)/$(MEDIA)
	if [ -d "$(MEDIA)" ]; then cp -r $(MEDIA) $(SEED)/; fi

dload: setup
	cp $(SEED)/$(DB) .
	rm -rf $(MEDIA)
	if [ -d "$(SEED)/$(MEDIA)" ]; then cp -r $(SEED)/$(MEDIA) .; fi

clean:
	rm -rf $(VENV)
	rm -f $(DB)
	rm -rf $(MEDIA)
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -path "./$(VENV)" -prune -o -path "*/migrations/0*.py" -exec rm -f {} +

.PHONY: run setup dsave dload clean
.SILENT: run setup dsave dload clean
