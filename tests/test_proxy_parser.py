from proxyflow.proxy import parse_proxy
def test_basic_proxy():
    assert parse_proxy("127.0.0.1:8080").host == "127.0.0.1"
