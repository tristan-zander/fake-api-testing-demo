FROM node:22-bullseye
WORKDIR /app
RUN npx playwright install-deps
ENTRYPOINT [ "/bin/bash" ]