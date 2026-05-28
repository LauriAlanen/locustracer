FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    cmake \
    libgtest-dev \
    pkg-config \
    libfftw3-dev \
    libeigen3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the whole project
COPY . .

# Build cpp_server
RUN cd application/cpp_server && cmake . && make

# Install node dependencies
RUN cd application/monitor_app/backend && npm install
RUN cd application/monitor_app/frontend && npm install

EXPOSE 5006/udp 8009 5173

# Start the stack
CMD ["./locustracer.sh", "start", "--container"]
