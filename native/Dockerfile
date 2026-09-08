# Clean-tree build of libhorn against the pinned Apache Celix.
# Host-installed Celix is not used. See native/celix-pin.json and ADR-0017.
#
# Build from the repository root:
#   docker build -f native/Dockerfile .
FROM debian:bookworm-slim

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        cmake \
        curl \
        g++ \
        make \
        python3 \
        uuid-dev \
        zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN cmake -S native -B build/native -DHORN_WITH_CELIX=ON \
    && cmake --build build/native --parallel

CMD ["./build/native/horn_celix", "probe"]
