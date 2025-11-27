# Use a Node.js LTS image as the base
FROM node:20

# Set up environment for non-interactive installs
ENV DEBIAN_FRONTEND=noninteractive

# Install build essentials, git, and curl
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Rust and Cargo
RUN curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Clone and install the circom compiler from source
RUN git clone https://github.com/iden3/circom.git \
    && cd circom \
    && cargo install --path circom

# Install snarkjs globally
RUN npm install -g snarkjs

# Set the working directory inside the container
WORKDIR /app

# Provide a default command to keep the container running and interactive
CMD ["bash"]