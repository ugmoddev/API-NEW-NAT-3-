from proxyflow.proxy import parse_proxy,parse_many
def test_formats():
 assert parse_proxy("1.2.3.4:8080").port==8080
 assert parse_proxy("socks5://u:p@host:1080").username=="u"
def test_dedup(): assert len(parse_many("a:1\na:1"))==1
