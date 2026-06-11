FROM oven/bun:1
RUN apt-get update && \
    apt-get install -y docker.io
