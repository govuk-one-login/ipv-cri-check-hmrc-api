FROM amazon/aws-cli:2.15.43
WORKDIR /
COPY run-tests.sh /
RUN chmod +x /run-tests.sh
ENTRYPOINT ["/run-tests.sh"]
