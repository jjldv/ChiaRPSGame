from chia.rpc.wallet_rpc_client import WalletRpcClient
from chia.util.ints import uint16
from chia.util.default_root import DEFAULT_ROOT_PATH
from chia.util.config import load_config
import asyncio


class WalletClient:
    @staticmethod
    async def getClient():
        config = load_config(DEFAULT_ROOT_PATH, "config.yaml")
        self_hostname = config["self_hostname"]
        wallet_rpc_port = config["wallet"]["rpc_port"]
        client = await WalletRpcClient.create(self_hostname, uint16(wallet_rpc_port), DEFAULT_ROOT_PATH, config)
        return client