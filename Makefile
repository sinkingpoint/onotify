.PHONY: up-be up-fe
up-be:
	npm run dev

up-fe:
	cd ui && npm run dev
