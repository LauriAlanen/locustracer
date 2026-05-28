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

# Cache Node dependencies first (this step only reruns if package.json changes)
COPY application/monitor_app/backend/package.json application/monitor_app/backend/
RUN cd application/monitor_app/backend && rm -f package-lock.json && npm install

COPY application/monitor_app/frontend/package.json application/monitor_app/frontend/
RUN cd application/monitor_app/frontend && rm -f package-lock.json && npm install

# Copy the whole project
COPY . .

# Build cpp_server (only reruns if project files change)
RUN cd application/cpp_server && cmake . && make

EXPOSE 5006/udp 8009 5173

# Start the stack
CMD ["./locustracer.sh", "start", "--container"]
