FROM golang:1.25-bookworm AS build
ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
WORKDIR /src
RUN curl -fsSL "https://codeload.github.com/minio/minio/tar.gz/refs/tags/${MINIO_VERSION}" -o /tmp/minio.tar.gz \
    && tar -xzf /tmp/minio.tar.gz --strip-components=1 \
    && CGO_ENABLED=0 go build -p 2 -trimpath -ldflags='-s -w' -o /out/minio .
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* && mkdir -p /data && chown 10001:10001 /data
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /licenses/MINIO-LICENSE
USER 10001:10001
VOLUME /data
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
