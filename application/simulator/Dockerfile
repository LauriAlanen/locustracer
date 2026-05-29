FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for compiling C/C++ extensions
# like scipy and pyroomacoustics in case binary wheels aren't available for the architecture.
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

EXPOSE 8010

# Note: when running this container to talk to a host or other container
# using 127.0.0.1 and binding to 127.0.0.2 etc, it is HIGHLY RECOMMENDED
# to run with --network host on Linux.
CMD ["python", "main.py"]
