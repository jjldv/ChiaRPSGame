from chia.rpc.full_node_rpc_client import FullNodeRpcClient
from chia.util.ints import uint16
from chia.util.default_root import DEFAULT_ROOT_PATH
from chia.util.config import load_config
import asyncio


class FNClient:
    @staticmethod
    async def getClient():
        config = load_config(DEFAULT_ROOT_PATH, "config.yaml")
        self_hostname = config["self_hostname"]
        full_node_rpc_port = config["full_node"]["rpc_port"]
        client = await FullNodeRpcClient.create(self_hostname, uint16(full_node_rpc_port), DEFAULT_ROOT_PATH, config)
        return client