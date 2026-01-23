FROM mcr.microsoft.com/devcontainers/python:3.11

ARG USERNAME=vscode
WORKDIR /home/${USERNAME}

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    build-essential \
    curl \
    git \
    python3-venv \
    udev \
    sudo

RUN pip3 install -U platformio

RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core/develop/platformio/assets/system/99-platformio-udev.rules \
    -o /etc/udev/rules.d/99-platformio-udev.rules

RUN groupadd -f dialout && groupadd -f plugdev \
    && usermod -a -G dialout ${USERNAME} \
    && usermod -a -G plugdev ${USERNAME}

USER ${USERNAME}