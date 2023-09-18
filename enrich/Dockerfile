FROM rust
WORKDIR /usr/src/enrich
COPY . .
RUN cargo install --path .
CMD ["enrich"]