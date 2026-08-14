default: help

help: ## Display available commands
	@fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	npm install

start: ## Start application in development (http://localhost:1234)
	npm run dev

build: ## Build application for production
	npm run build

preview: build ## Preview production build locally
	npm run preview

lint: ## Run ESLint
	npm run lint

knip: ## Find unused files, exports and dependencies
	npm run knip

format: ## Format code with Prettier
	npm run format

format-check: ## Check formatting with Prettier
	npm run format:check

typecheck: ## Run TypeScript type checker
	npx tsc -b --noEmit

test: ## Run unit and component tests
	npm run test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

fixtures: ## Decode tools/fixtures/*.jpg to PGM (requires ffmpeg)
	@for f in tools/fixtures/*.jpg; do \
		ffmpeg -y -loglevel error -i "$$f" -vf format=gray "$${f%.jpg}.pgm" && echo "$${f%.jpg}.pgm"; \
	done

bench: ## Run the engine on tools/fixtures and write SVG reports to out/
	npm run bench

print-preview: build ## Build a print-layout harness page (see AGENTS.md to check page count)
	npm run print-preview -- lapin-dodo /tmp/print.html

fix: format lint ## Format and lint all code

check: build lint typecheck knip test ## Run all checks (build, lint, typecheck, knip, tests)
	@echo "All checks passed!"

clean: ## Remove build artifacts and dependencies
	rm -rf dist node_modules coverage out
