import ast
import asyncio
import json
import string
from chia.types.blockchain_format.coin import Coin
from chia.types.blockchain_format.sized_bytes import bytes32
from chia.types.blockchain_format.program import Program
from chia.util.ints import uint16, uint64
from chia.util.hash import std_hash
from clvm.casts import int_to_bytes
from cdv.util.load_clvm import load_clvm
from chia.util.ints import uint32
from chia.types.blockchain_format.serialized_program import SerializedProgram
from chia.rpc.full_node_rpc_client import  CoinRecord
from chia.types.coin_spend import CoinSpend, compute_additions_with_cost
from chia.types.spend_bundle import SpendBundle
from chia.util.bech32m import encode_puzzle_hash, decode_puzzle_hash
from chia.util.config import load_config
from chia.util.default_root import DEFAULT_ROOT_PATH
from blspy import PrivateKey, AugSchemeMPL, G2Element
from clvm_tools.binutils import disassemble
from blspy import (PrivateKey, AugSchemeMPL,G1Element, G2Element)
from RPSChiaLisp.WalletClient import WalletClient
from RPSChiaLisp.FNClient import FNClient
from RPSChiaLisp.GameDatabase import GameDatabase
import datetime
from RPSChiaLisp.Firebase import Firebase
import requests


class RPSDriver:
    def __init__(self, hexPrivateKey:str):
        self.urlApi = "https://api.coinset.org"
        self.Firebase =  Firebase("serviceAccountKey.json")
        self.GameDatabase = GameDatabase()
        self.CASH_OUT_ACTION = 0
        self.ACTION_JOIN_PLAYER1 = 1
        self.ACTION_JOIN_PLAYER2 = 2
        self.ACTION_CLOSE_GAME = 3
        self.ACTION_REVEAL = 4
        self.ACTION_CLAIM_PLAYER2 = 5
        self.ACTION_WALLET_SET_FEE = 3

        #Network info
        self.GENESIS_CHALLENGE_HEX = None
        self.GENESIS_CHALLENGE = None
        self.CHIA_PREFIX = ""
        self.IS_MAINNET = False

        self.SERVER_GAME_PRIVATE_KEY: PrivateKey = PrivateKey.from_bytes(bytes.fromhex(hexPrivateKey))
        self.SERVER_GAME_PUBLIC_KEY = self.SERVER_GAME_PRIVATE_KEY.get_g1()

        #Load CLVMs
        self.GAME_WALLET_MOD = load_clvm("GameWallet.clsp", package_or_requirement=__name__, search_paths=["../include", "../RPSChiaLisp"])
        self.GAME_MOD = load_clvm("Game.clsp", package_or_requirement=__name__, search_paths=["../include", "../RPSChiaLisp"])
        self.PLAYER_ORACLE_MOD = load_clvm("PlayerOracle.clsp", package_or_requirement=__name__, search_paths=["../include", "../RPSChiaLisp"])
        self.PUBLIC_ORACLE_MOD = load_clvm("PublicOracle.clsp", package_or_requirement=__name__, search_paths=["../include", "../RPSChiaLisp"])       
        
        
        asyncio.create_task(self.configNetwork())
    async def syncHistoryGames(self):
        try:
            lastIndexSync = self.GameDatabase.getLastIndexSync()
            print("Last index sync history", lastIndexSync)
            historyGames = await self.getHistoryGames(lastIndexSync)
            print("Found history games", len(historyGames["historyGames"]))
            if historyGames["success"]:
                for game in historyGames["historyGames"]:
                    print("processing game", game["coin_id"])
                    gameF = (
                            game["parent_coin_info"],
                            game["coin_id"],
                            game["puzzleHash"],
                            game["puzzleReveal"],
                            game["gameResult"],
                            game["stage"],
                            game["stageName"],
                            game["publicKeyWinner"],
                            game["publicKeyPlayer1"],
                            game["publicKeyPlayer2"],
                            game["compromisePlayer1"],
                            game["selectionPlayer1"],
                            game["secretKeyPlayer1"],
                            game["emojiSelectionPlayer1"],
                            game["selectionPlayer2"],
                            game["emojiSelectionPlayer2"],
                            game["date"],
                            game["timestamp"],
                            game["amount"],
                            game["confirmed_block_index"],
                            game["spent_block_index"],
                            game["oracleConfirmedBlockIndex"],
                            "SPENT"
                        )
                    if lastIndexSync < game["oracleConfirmedBlockIndex"]:
                        self.GameDatabase.updateLastIndexSync(game["oracleConfirmedBlockIndex"])
                        lastIndexSync = game["oracleConfirmedBlockIndex"]
                    if self.GameDatabase.existsCoinId(game["coin_id"]) == True:
                        self.GameDatabase.deleteCoinId(game["coin_id"])
                    self.GameDatabase.insertGameData(gameF)
        except Exception as e:
            print("Error syncing history games", e)
            raise e
    async def syncOpenGames(self):
        try:
            lastIndexSync = self.GameDatabase.getLastIndexSyncOpenGames()
            print("Last index sync open games", lastIndexSync)
            openGames = await self.getOpenGames(lastIndexSync)
            print("Found open games", len(openGames["openGames"]))
            if openGames["success"]:
                for game in openGames["openGames"]:
                    print("processing game", game["coin_id"])
                    gameF = (
                            game["parent_coin_info"],
                            game["coin_id"],
                            game["puzzleHash"],
                            game["puzzleReveal"],
                            game["gameResult"],
                            game["stage"],
                            game["stageName"],
                            game["publicKeyWinner"],
                            game["publicKeyPlayer1"],
                            game["publicKeyPlayer2"],
                            game["compromisePlayer1"],
                            game["selectionPlayer1"],
                            game["secretKeyPlayer1"],
                            game["emojiSelectionPlayer1"],
                            game["selectionPlayer2"],
                            game["emojiSelectionPlayer2"],
                            game["date"],
                            game["timestamp"],
                            game["amount"],
                            game["confirmed_block_index"],
                            game["spent_block_index"],
                            game["oracleConfirmedBlockIndex"],
                            "SPENT" if game["spent_block_index"] != 0 else "UNSPENT"

                        )
                    if lastIndexSync < game["oracleConfirmedBlockIndex"]:
                        self.GameDatabase.updateLastIndexSyncOpenGames(game["oracleConfirmedBlockIndex"])
                        lastIndexSync = game["oracleConfirmedBlockIndex"]
                    if self.GameDatabase.existsCoinId(game["coin_id"]) == True:
                        self.GameDatabase.deleteCoinId(game["coin_id"])
                    self.GameDatabase.insertGameData(gameF)
        except Exception as e:
            print("Error syncing open games", e)
            raise e
    async def getLeaderboard(self):
        try:
            topWinners = self.GameDatabase.topWinners()
            topEarners = self.GameDatabase.topEarners()
            return {"success": True, "topWinners": topWinners, "topEarners": topEarners}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getOpenGamesDB(self):
        try:
            openGames = self.GameDatabase.getOpenGames()
            return {"success": True, "openGames": openGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getHistoryGamesDB(self):
        try:
            historyGames = self.GameDatabase.getHistoryGames()
            return {"success": True, "historyGames": historyGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getGameDetailsDB(self, coinId: str):
        try:
            game = self.GameDatabase.getGameDetails(coinId)
            
            if game["stage"] == 3:
                game["selectionPlayer2"] = "Reveal P1 to see"
                game["emojiSelectionPlayer2"] = self.getEmoji(0)
            
            game["puzzleRevealDisassembled"] = disassemble(Program.fromhex(game["puzzleReveal"]))
            gameCoins = self.GameDatabase.getCoinsChain(coinId)
            return {"success": True, "game": game, "gameCoins": gameCoins }
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getUserHistoryGamesDB(self, pubkey: str):
        try:
            historyGames = self.GameDatabase.getUserHistoryGames(pubkey)
            return {"success": True, "historyGames": historyGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getUserOpenGamesDB(self, pubkey: str):
        try:
            openGames = self.GameDatabase.getUserOpenGames(pubkey)
            return {"success": True, "openGames": openGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getCoinRecordsByParentIds(self, parentIds: list, includeSpentCoins: bool = False, startHeight: int = None, endHeight: int = None):
        try:
            full_node_client = await FNClient.getClient()
            coin_records = await full_node_client.get_coin_records_by_parent_ids(parentIds, include_spent_coins=includeSpentCoins, start_height=startHeight, end_height=endHeight)
            return coin_records
        except Exception as e:
            return None
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def calculateCoinId(self, parent_coin_info: str, puzzle_hash: str, amount: uint64):
        parent_coin_info = parent_coin_info.replace("0x", "")
        puzzle_hash = puzzle_hash.replace("0x", "")
        coin_id = std_hash(bytes32.fromhex(parent_coin_info) + bytes32.fromhex(puzzle_hash) + int_to_bytes(amount))
        return coin_id.hex()
    async def createSpendJoinPlayer1(self, pubKeyHex:str, coinId:str, fee:int, betAmount:int, selectionHash:str, cashOutAddressHash:str):
        try:
            publicKeyPlayer1 = G1Element.from_bytes(bytes.fromhex(pubKeyHex))
            PublicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            PlayerOracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer1,self.GAME_MOD.get_tree_hash())
            WalletPlayerMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer1)
            GamePlayerMod = self.GAME_MOD.curry(self.GAME_MOD.get_tree_hash(),PublicOracleMod.get_tree_hash(),PlayerOracleMod.get_tree_hash(), WalletPlayerMod.get_tree_hash(),publicKeyPlayer1)
            targetHash = GamePlayerMod.get_tree_hash()
            coin = await self.getCoin(coinId)
            solution = Program.to([
                self.ACTION_JOIN_PLAYER1,
                coin.puzzle_hash, 
                coin.amount,
                fee, 
                targetHash, 
                betAmount,
                bytes.fromhex(selectionHash),
                bytes.fromhex(cashOutAddressHash),
                PlayerOracleMod.get_tree_hash()])
            spendWallet = CoinSpend(
                coin,
                SerializedProgram.from_program(WalletPlayerMod),
                SerializedProgram.from_program(solution)
            )
            coinOpenGame = Coin(bytes32.fromhex(coinId), GamePlayerMod.get_tree_hash(), betAmount)
            solutionOpenGame = Program.to([
                    bytes.fromhex(selectionHash),
                    bytes.fromhex(cashOutAddressHash),
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    1,
                    betAmount,
                    0])
            spendOpenGame = CoinSpend(
                coinOpenGame,
                SerializedProgram.from_program(GamePlayerMod),
                SerializedProgram.from_program(solutionOpenGame),
            )
            return [spendWallet, spendOpenGame]
        except Exception as e:
            print("Error creating spend open game", e)
            raise e 
    async def createSolutionClaimGame(self,coinAmount:int,fee:int):
        solutionGame = Program.to([
                    1,
                    1,
                    self.ACTION_CLAIM_PLAYER2,
                    coinAmount,
                    fee])
        return {"success": True, "solution": SerializedProgram.from_program(solutionGame).to_bytes().hex()}
    async def createSolutionCloseGame(self,coinAmount:int,fee:int):
        solutionGame = Program.to([
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    self.ACTION_CLOSE_GAME,
                    coinAmount,
                    fee])
        return {"success": True, "solution": SerializedProgram.from_program(solutionGame).to_bytes().hex()}
    async def createSolutionRevealGame(self,selection:int,revealKey:str,coinAmount:int):
        solutionGame = Program.to([
                    selection,
                    bytes(revealKey, 'utf-8'),
                    self.ACTION_REVEAL,
                    coinAmount,
                    0])
        return {"success": True, "solution": SerializedProgram.from_program(solutionGame).to_bytes().hex()}
    async def createSolutionJoinPlayer1(self,pubKeyHex:str,amount:int,selectionHash:str,cashOutAddressHash:str):
        try:
            publicKeyPlayer1 = G1Element.from_bytes(bytes.fromhex(pubKeyHex))
            PublicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            PlayerOracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer1,self.GAME_MOD.get_tree_hash())
            WalletPlayerMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer1)
            GamePlayerMod = self.GAME_MOD.curry(self.GAME_MOD.get_tree_hash(),PublicOracleMod.get_tree_hash(),PlayerOracleMod.get_tree_hash(), WalletPlayerMod.get_tree_hash(),publicKeyPlayer1)
            targetHash = GamePlayerMod.get_tree_hash()
            solution = Program.to([
                self.ACTION_JOIN_PLAYER1,
                WalletPlayerMod.get_tree_hash(), 
                amount,
                0, 
                targetHash, 
                amount,
                bytes.fromhex(selectionHash),
                bytes.fromhex(cashOutAddressHash),
                PlayerOracleMod.get_tree_hash()])
            solutionOpenGame = Program.to([
                    bytes.fromhex(selectionHash),
                    bytes.fromhex(cashOutAddressHash),
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    1,
                    amount,
                    0])
            return {"success": True, "message": "", "solutionGameWallet": SerializedProgram.from_program(solution).to_bytes().hex(),"solutionGame": SerializedProgram.from_program(solutionOpenGame).to_bytes().hex()}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def createSolutionJoinPlayer2(self, publicKeyP2Hex:str, coinId:str, selection:int, cashOutAddressHash:str):
        try:

            gameCoin = await self.getCoinRecord(coinId)
            publicKeyPlayer2 = G1Element.from_bytes(bytes.fromhex(publicKeyP2Hex))
            WalletPlayerMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer2)
            player2OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer2,self.GAME_MOD.get_tree_hash())
            solutionWallet = Program.to([
                self.ACTION_JOIN_PLAYER2,
                WalletPlayerMod.get_tree_hash(), 
                gameCoin.coin.amount,
                0, 
                gameCoin.coin.puzzle_hash, 
                gameCoin.coin.amount,
                selection,
                bytes.fromhex(cashOutAddressHash),
                player2OracleMod.get_tree_hash()])
           
                
            solutionGame = Program.to([
                    WalletPlayerMod.get_tree_hash(),
                    publicKeyPlayer2,
                    selection,
                    bytes.fromhex(cashOutAddressHash),
                    player2OracleMod.get_tree_hash(),
                    0,
                    0,
                    self.ACTION_JOIN_PLAYER2,
                    gameCoin.coin.amount,
                    0])
            
            return {"success": True, "message": "", "solutionGameWallet": SerializedProgram.from_program(solutionWallet).to_bytes().hex(),"solutionGame": SerializedProgram.from_program(solutionGame).to_bytes().hex()}
        except Exception as e:
            print("Error creating spend open game", e)
            raise e
    async def createSpendJoinPlayer2(self, publicKeyP2Hex:str, coinId:str,parentIdWallet:str, fee:int, selection:int, cashOutAddressHash:str):
        try:
            gameCoin = await self.getCoinRecord(coinId)
            # publicKeyPlayer2 = G1Element.from_bytes(bytes.fromhex(publicKeyP2Hex))
            # WalletPlayerMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer2)
            # player2OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer2,self.GAME_MOD.get_tree_hash())
            # coinWallet = Coin(
            #     bytes32.fromhex(parentIdWallet),
            #     WalletPlayerMod.get_tree_hash(),
            #     uint64(gameCoin.coin.amount)
            # )
            # solutionWallet = Program.to([
            #     self.ACTION_JOIN_PLAYER2,
            #     WalletPlayerMod.get_tree_hash(), 
            #     gameCoin.coin.amount,
            #     fee, 
            #     gameCoin.coin.puzzle_hash, 
            #     gameCoin.coin.amount,
            #     selection,
            #     bytes.fromhex(cashOutAddressHash),
            #     player2OracleMod.get_tree_hash()])
            # spendWallet = CoinSpend(
            #     coinWallet,
            #     SerializedProgram.from_program(WalletPlayerMod),
            #     SerializedProgram.from_program(solutionWallet)
            # )

            puzzleAndSolution = await self.getPuzzleAndSolution(gameCoin.coin.parent_coin_info.hex(), gameCoin.confirmed_block_index)
            infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
            infoStage = await self.getGameStageParsed(puzzleAndSolution.puzzle_reveal.to_program().uncurry()[1],infoSolutionParams["params"])
            gameParams = await self.getGameParams(infoStage["stage"],infoStage["curriedParams"],infoSolutionParams["params"])
            publicOracleCoin,player1OracleCoin,player2OracleCoin = await self.getGameOracleCoins(gameCoin,std_hash(infoStage["GameMod"].get_tree_hash()).hex(),gameParams["publicKeyPlayer1"])

            # player2WalletMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer2)
                
            # solutionGame = Program.to([
            #         player2WalletMod.get_tree_hash(),
            #         publicKeyPlayer2,
            #         selection,
            #         bytes.fromhex(cashOutAddressHash),
            #         player2OracleMod.get_tree_hash(),
            #         0,
            #         0,
            #         self.ACTION_JOIN_PLAYER2,
            #         gameCoin.coin.amount,
            #         fee])
            # spendGame = CoinSpend(
            #     gameCoin.coin,
            #     SerializedProgram.from_program(infoStage["GameMod"]),
            #     SerializedProgram.from_program(solutionGame)
            # )
            publicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            solutionPublicOracle = Program.to([gameCoin.coin.name()])
            spendPublicOracle = CoinSpend(
                publicOracleCoin.coin,
                SerializedProgram.from_program(publicOracleMod),
                SerializedProgram.from_program(solutionPublicOracle)
            )
            player1OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,bytes.fromhex(gameParams["publicKeyPlayer1"]),self.GAME_MOD.get_tree_hash())
            solutionPlayerOracle = Program.to([gameCoin.coin.name()])
            spendPlayerOracle = CoinSpend(
                player1OracleCoin.coin,
                SerializedProgram.from_program(player1OracleMod),
                SerializedProgram.from_program(solutionPlayerOracle)
            )
            return [spendPublicOracle,spendPlayerOracle]
        except Exception as e:
            print("Error creating spend open game", e)
            raise e
    async def joinPlayer2(self,spendBundle,publicKeyP2Hex:str, coinId:str,parentIdWallet:str, fee:int, selection:str, cashOutAddressHash:str, signature:str):
        try:
            spend = await self.createSpendJoinPlayer2(publicKeyP2Hex, coinId,parentIdWallet, fee, selection, cashOutAddressHash)
            fullSpendBundle = spend + spendBundle.coin_spends
            #gameCoin = spend[1].coin
            publicOracleCoin = spend[-2].coin
            playerOracleCoin = spend[-1].coin

            signature_bytes = bytes.fromhex(signature)
            signatureP2 = G2Element.from_bytes(signature_bytes)

            signServerPublic: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(bytes.fromhex(coinId))
                            + publicOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer1: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(bytes.fromhex(coinId))
                            + playerOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signaturaGame = G2Element()
            aggregated_signature = AugSchemeMPL.aggregate([signatureP2, signServerPublic,signServerPlayer1,signaturaGame])
            spend_bundle = SpendBundle(fullSpendBundle, aggregated_signature)
            status = await self.pushTx(spend_bundle)
            if status["success"] == False:
                return {"success": False, "message": self.parseError(status["message"])}
            return {"success": True, "message": "Instruction added to mempool", "status": status}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)}
    async def joinPlayer1(self,pubkey:str, coinId:str, fee:int,betAmount:int,compromisePlayer1:str,puzzleHashPlayer1:str, signature:str):
        try:
            spend = await self.createSpendJoinPlayer1(pubkey, coinId, fee, betAmount,compromisePlayer1,puzzleHashPlayer1)
            signature_bytes = bytes.fromhex(signature)
            sig1 = G2Element.from_bytes(signature_bytes)
            sig2 = G2Element()
            aggregated_signature = AugSchemeMPL.aggregate([sig1, sig2])
            spend_bundle = SpendBundle(spend, aggregated_signature)
            status = await self.pushTx(spend_bundle)
            if status["success"] == False:
                return {"success": False, "message": self.parseError(status["message"])}
            return {"success": True, "message": "Instruction added to mempool", "status": status}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)}
    async def getCoinRecordByHint(self, confirmed_block_index: int, hint: str,includeSpentCoins: bool = False):
        try:
            full_node_client = await FNClient.getClient()
            coin_record = await full_node_client.get_coin_records_by_hint(hint=bytes.fromhex(hint), include_spent_coins=includeSpentCoins, start_height=confirmed_block_index, end_height=confirmed_block_index+1)
            return coin_record
        except Exception as e:
            return None
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    #TODO: Remove hadouken
    async def getOpenGames(self, startHeight: int = None):
        try:
            PublicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            openGames = []
            listOracleCoins = await self.getUnspentCoins(PublicOracleMod.get_tree_hash().hex(),startHeight)
            for oracleCoin in listOracleCoins:
                parentCoin = await self.getCoinRecord(oracleCoin.coin.parent_coin_info.hex())
                if oracleCoin.confirmed_block_index < startHeight:
                    continue
                infoStageParent = await self.getGameStageInfo(parentCoin)
                gameCoin = []
                if oracleCoin.spent_block_index == 0:
                    gameCoin = await self.getCoinRecordByHint(oracleCoin.confirmed_block_index,std_hash(infoStageParent["GameMod"].get_tree_hash()).hex(),False)
                
                if len(gameCoin) <= 2:
                    continue
                coin = parentCoin if len(gameCoin) <= 2 else [c for c in gameCoin if c.coin.amount != 0][0]
                info = infoStageParent if len(gameCoin) == 0 else await self.getGameStageInfo(coin)
                await self.sendNotificationtoPubkey(info["gameParams"]["publicKeyPlayer1"],"Game update",info["stageName"],"https://chiarps.mrdennis.dev/gameDetails/"+coin.coin.name().hex())
                await self.sendNotificationtoPubkey(info["gameParams"]["publicKeyPlayer2"],"Game update",info["stageName"],"https://chiarps.mrdennis.dev/gameDetails/"+coin.coin.name().hex())
                publicKeyP1 = G1Element.from_bytes(bytes.fromhex(info["gameParams"]["publicKeyPlayer1"]))
                player1WalletMod = self.GAME_WALLET_MOD.curry(publicKeyP1)
                gameParentCoins = await self.getGameParentCoins(coin,player1WalletMod)
                for gameCoin in gameParentCoins:
                    infoStage = await self.getGameStageInfo(gameCoin)
                    formatedCoin = { 
                        'parent_coin_info': gameCoin.coin.parent_coin_info.hex(),
                        'puzzle_hash': gameCoin.coin.puzzle_hash.hex(),
                        'amount': gameCoin.coin.amount,
                        'coin_id': gameCoin.coin.name().hex(),
                        'confirmed_block_index': gameCoin.confirmed_block_index,
                        'spent_block_index': gameCoin.spent_block_index,
                        'coinbase': gameCoin.coinbase,
                        'timestamp': gameCoin.timestamp,
                        'date': datetime.datetime.fromtimestamp(gameCoin.timestamp).strftime('%d %b %Y %H:%M') + " hrs",
                        'compromisePlayer1': infoStage["gameParams"]["compromisePlayer1"],
                        'puzzleHashPlayer1': infoStage["gameParams"]["puzzleHashPlayer1"],
                        'publicKeyPlayer1': infoStage["gameParams"]["publicKeyPlayer1"],
                        'publicKeyPlayer2': infoStage["gameParams"]["publicKeyPlayer2"],
                        'selectionPlayer1': infoStage["gameParams"]["selectionPlayer1"],
                        'selectionPlayer2': infoStage["gameParams"]["selectionPlayer2"],
                        "secretKeyPlayer1": infoStage["gameParams"]["secretKeyPlayer1"],
                        "emojiSelectionPlayer1": infoStage["gameParams"]["emojiSelectionPlayer1"],
                        "emojiSelectionPlayer2": infoStage["gameParams"]["emojiSelectionPlayer2"],
                        'gameResult': infoStage["gameResult"],
                        'stage': infoStage["stage"],
                        'publicKeyWinner': infoStage["publicKeyWinner"],
                        'stageName': infoStage["stageName"],
                        'oracleConfirmedBlockIndex': gameCoin.confirmed_block_index,
                        'puzzleHash': infoStage["GameMod"].get_tree_hash().hex(),
                        'puzzleReveal': infoStage["GameMod"].__str__()

                    }
                    openGames.append(formatedCoin)
            return {"success": True, "openGames": openGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    #TODO: Remove hadouken
    async def getUserOpenGames(self, pubkey: str):
        try:
            userPublicKey = G1Element.from_bytes(bytes.fromhex(pubkey))
            PlayerOracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,userPublicKey,self.GAME_MOD.get_tree_hash())
            openGames = []
            listOracleCoins = await self.getUnspentCoins(PlayerOracleMod.get_tree_hash().hex())
            for oracleCoin in listOracleCoins:
                parentCoin = await self.getCoinRecord(oracleCoin.coin.parent_coin_info.hex())
                infoStageParent = await self.getGameStageInfo(parentCoin)
                gameCoin = await self.getCoinRecordByHint(oracleCoin.confirmed_block_index,std_hash(infoStageParent["GameMod"].get_tree_hash()).hex(),False)
                if gameCoin == None:
                    raise Exception("Game coin not found")
                gameCoin = [coin for coin in gameCoin if coin.coin.amount != 0][0]
                infoStage = await self.getGameStageInfo(gameCoin)
                formatedCoin = { 
                    'parent_coin_info': gameCoin.coin.parent_coin_info.hex(),
                    'puzzle_hash': gameCoin.coin.puzzle_hash.hex(),
                    'amount': gameCoin.coin.amount,
                    'coin_id': gameCoin.coin.name().hex(),
                    'confirmed_block_index': gameCoin.confirmed_block_index,
                    'spent_block_index': gameCoin.spent_block_index,
                    'coinbase': gameCoin.coinbase,
                    'timestamp': gameCoin.timestamp,
                    'date': datetime.datetime.fromtimestamp(gameCoin.timestamp).strftime('%d %b %Y %H:%M') + " hrs",
                    'compromisePlayer1': infoStage["gameParams"]["compromisePlayer1"],
                    'puzzleHashPlayer1': infoStage["gameParams"]["puzzleHashPlayer1"],
                    'stage': infoStage["stage"],
                    'stageName': infoStage["stageName"],
                }
                openGames.append(formatedCoin)
                
            return {"success": True, "openGames": openGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getUserHistoryGames(self, pubkey: str):
        try:
            publicKeyPlayer1 = G1Element.from_bytes(bytes.fromhex(pubkey))
            PlayerOracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer1,self.GAME_MOD.get_tree_hash())
            historyGames = []
            listOracleCoins = await self.getUnspentCoins(std_hash(PlayerOracleMod.get_tree_hash()).hex())
            for oracleCoin in listOracleCoins:
                parentCoin = await self.getCoinRecord(oracleCoin.coin.parent_coin_info.hex())
                infoStage = await self.getGameStageInfo(parentCoin)
                formatedCoin = { 
                    'parent_coin_info': parentCoin.coin.parent_coin_info.hex(),
                    'puzzle_hash': parentCoin.coin.puzzle_hash.hex(),
                    'amount': parentCoin.coin.amount,
                    'coin_id': parentCoin.coin.name().hex(),
                    'confirmed_block_index': parentCoin.confirmed_block_index,
                    'spent_block_index': parentCoin.spent_block_index,
                    'coinbase': parentCoin.coinbase,
                    'timestamp': parentCoin.timestamp,
                    'date': datetime.datetime.fromtimestamp(parentCoin.timestamp).strftime('%d %b %Y %H:%M') + " hrs",
                    'compromisePlayer1': infoStage["gameParams"]["compromisePlayer1"],
                    'puzzleHashPlayer1': infoStage["gameParams"]["puzzleHashPlayer1"],
                    'stage': infoStage["stage"],
                    'stageName': infoStage["stageName"],
                }
                historyGames.append(formatedCoin)
            return {"success": True, "historyGames": historyGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getHistoryGames(self,startHeight: int = None, endHeight: int = None):
        try:
            PublicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            historyGames = []
            listOracleCoins = await self.getUnspentCoins(std_hash(PublicOracleMod.get_tree_hash()).hex(),startHeight)
            for oracleCoin in listOracleCoins:
                parentCoin = await self.getCoinRecord(oracleCoin.coin.parent_coin_info.hex())
                infoStage = await self.getGameStageInfo(parentCoin)
                if oracleCoin.confirmed_block_index < startHeight:
                    continue
                await self.sendNotificationtoPubkey(infoStage["gameParams"]["publicKeyPlayer1"],"Your game has ended", "Game result: " + infoStage["gameResult"],"https://chiarps.mrdennis.dev/gameDetails/"+parentCoin.coin.name().hex())
                await self.sendNotificationtoPubkey(infoStage["gameParams"]["publicKeyPlayer2"],"Your game has ended", "Game result: " + infoStage["gameResult"],"https://chiarps.mrdennis.dev/gameDetails/"+parentCoin.coin.name().hex())
                publicKeyP1 = G1Element.from_bytes(bytes.fromhex(infoStage["gameParams"]["publicKeyPlayer1"]))
                player1WalletMod = self.GAME_WALLET_MOD.curry(publicKeyP1)
                gameParentCoins = await self.getGameParentCoins(parentCoin,player1WalletMod)
                for gameCoin in gameParentCoins:
                    infoStage = await self.getGameStageInfo(gameCoin)
                    formatedCoin = { 
                        'parent_coin_info': gameCoin.coin.parent_coin_info.hex(),
                        'puzzle_hash': gameCoin.coin.puzzle_hash.hex(),
                        'amount': gameCoin.coin.amount,
                        'coin_id': gameCoin.coin.name().hex(),
                        'confirmed_block_index': gameCoin.confirmed_block_index,
                        'spent_block_index': gameCoin.spent_block_index,
                        'coinbase': gameCoin.coinbase,
                        'timestamp': gameCoin.timestamp,
                        'date': datetime.datetime.fromtimestamp(gameCoin.timestamp).strftime('%d %b %Y %H:%M') + " hrs",
                        'compromisePlayer1': infoStage["gameParams"]["compromisePlayer1"],
                        'puzzleHashPlayer1': infoStage["gameParams"]["puzzleHashPlayer1"],
                        'publicKeyPlayer1': infoStage["gameParams"]["publicKeyPlayer1"],
                        'publicKeyPlayer2': infoStage["gameParams"]["publicKeyPlayer2"],
                        'selectionPlayer1': infoStage["gameParams"]["selectionPlayer1"],
                        'selectionPlayer2': infoStage["gameParams"]["selectionPlayer2"],
                        "secretKeyPlayer1": infoStage["gameParams"]["secretKeyPlayer1"],
                        "emojiSelectionPlayer1": infoStage["gameParams"]["emojiSelectionPlayer1"],
                        "emojiSelectionPlayer2": infoStage["gameParams"]["emojiSelectionPlayer2"],
                        'gameResult': infoStage["gameResult"],
                        'stage': infoStage["stage"],
                        'publicKeyWinner': infoStage["publicKeyWinner"],
                        'stageName': infoStage["stageName"],
                        'oracleConfirmedBlockIndex': oracleCoin.confirmed_block_index,
                        'puzzleHash': infoStage["GameMod"].get_tree_hash().hex(),
                        'puzzleReveal': infoStage["GameMod"].__str__()
                    }
                    historyGames.append(formatedCoin)
            return {"success": True, "historyGames": historyGames}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getPuzzleAndSolution(self, coinId: str, blockIndex: int):
        try:
            full_node_client = await FNClient.getClient()
            puzzle_and_solution = await full_node_client.get_puzzle_and_solution(
                bytes32.fromhex(coinId),
                uint32(blockIndex),
            )
            return puzzle_and_solution
        except Exception as e:
            return None
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def getFeeEstimateJoinPlayer1(self,pubkey:str, coinId:str):
        try:
            full_node_client = await FNClient.getClient()
            spend = await self.createSpendJoinPlayer1(pubkey, coinId, 0, 1,self.GAME_MOD.get_tree_hash().hex(),self.GAME_WALLET_MOD.get_tree_hash().hex())
            created_coins1, cost1 = compute_additions_with_cost(spend[0])
            created_coins2, cost2 = compute_additions_with_cost(spend[1])
            infoFee = await full_node_client.get_fee_estimate(target_times=[60, 300, 600], cost= cost1 + cost2)
            return {"success": True, "infoFee": infoFee}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()

    async def getFeeEstimateJoinPlayer2(self,pubkey:str, coinId:str, coinIdWallet:str):
        try:
            full_node_client = await FNClient.getClient()
            spend = await self.createSpendJoinPlayer2(pubkey, coinId,coinIdWallet, 0, 1,self.GAME_WALLET_MOD.get_tree_hash().hex())
            created_coins1, cost1 = compute_additions_with_cost(spend[0])
            created_coins2, cost2 = compute_additions_with_cost(spend[1])
            created_coins3, cost3 = compute_additions_with_cost(spend[2])
            created_coins4, cost4 = compute_additions_with_cost(spend[3])
            infoFee = await full_node_client.get_fee_estimate(target_times=[60, 300, 600], cost= cost1 + cost2 + cost3+ cost4)
            return {"success": True, "infoFee": infoFee}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()

    async def getFeeEstimateCashOut(self,publicKeyPlayerHex:str, coinId:str):
        try:
            full_node_client = await FNClient.getClient()
            dummyHash = self.GAME_WALLET_MOD.get_tree_hash().hex()
            spend = await self.createSpendCashOutCoin(publicKeyPlayerHex, coinId, dummyHash, 0)
            created_coins, cost = compute_additions_with_cost(spend)
            fee = await full_node_client.get_fee_estimate(target_times=[60, 300, 600], cost=cost)
            return {"success": True, "infoFee": fee}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()

    async def concat(self, params: list):
        try:
            result = b""
            for param in params:
                if isinstance(param, str):
                    if param.startswith("0x") and len(param) % 2 == 0:
                        result += bytes.fromhex(param[2:])
                    else:
                        result += param.encode("utf-8")
                elif isinstance(param, int):
                    result += int_to_bytes(param)
                elif isinstance(param, bytes):
                    result += param
                else:
                    raise ValueError("Invalid parameter type")
            resultHashHex = result.hex()
            return {"success": True, "result": resultHashHex}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def pushTx(self, spend_bundle: SpendBundle):
        try:
            spend_bundleJson = spend_bundle.to_json_dict()
            status = await self.fetch("/push_tx", {"spend_bundle": spend_bundleJson})
            return status
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getCoin(self, coin_id: str):
        try:
            full_node_client = await FNClient.getClient()
            coin_record = await full_node_client.get_coin_record_by_name(bytes32.fromhex(coin_id))
            return coin_record.coin
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def getCoinRecord(self, coin_id: str):
        try:
            full_node_client = await FNClient.getClient()
            coin_record = await full_node_client.get_coin_record_by_name(bytes32.fromhex(coin_id))
            return coin_record
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def getUnspentCoinsWithIds(self, puzzle_hash: str):
        coins = await self.getUnspentCoins(puzzle_hash)
        enriched_coins = []
        for coin_record in coins:
            coin = coin_record.coin
            coin_id = coin.name().hex()
            enriched_coin = {
                'parent_coin_info': coin.parent_coin_info.hex(),
                'puzzle_hash': coin.puzzle_hash.hex(),
                'amount': coin.amount,
                'coin_id': coin_id, 
                'confirmed_block_index': coin_record.confirmed_block_index,
                'spent_block_index': coin_record.spent_block_index,
                'coinbase': coin_record.coinbase,
                'timestamp': coin_record.timestamp,
            }
            enriched_coins.append(enriched_coin)

        return enriched_coins
    async def getUnspentCoins(self, puzzleHash: str,startHeight: int = None, endHeight: int = None):
        try:
            full_node_client = await FNClient.getClient()
            coins = await full_node_client.get_coin_records_by_puzzle_hash(bytes.fromhex(puzzleHash), include_spent_coins=False, start_height=startHeight, end_height=endHeight)
            return coins
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def getCoinRecordsByPuzzleHash(self, puzzle_hash: str, include_spent_coins: bool = False, start_height: int = None, end_height: int = None):
        try:
            full_node_client = await FNClient.getClient()
            coins = await full_node_client.get_coin_records_by_puzzle_hash(bytes.fromhex(puzzle_hash), include_spent_coins=include_spent_coins, start_height=start_height, end_height=end_height)
            return coins
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
        
    def getWalletGameInfo(self, pubKeyHex:str):
        try:
            publicKeyPlayer1 = G1Element.from_bytes(bytes.fromhex(pubKeyHex))
            PublicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            PlayerOracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer1,self.GAME_MOD.get_tree_hash())
            WalletPlayerMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer1)
            GamePlayerMod = self.GAME_MOD.curry(self.GAME_MOD.get_tree_hash(),PublicOracleMod.get_tree_hash(),PlayerOracleMod.get_tree_hash(), WalletPlayerMod.get_tree_hash(),publicKeyPlayer1)
            
            treehashOpenGamePlayer = GamePlayerMod.get_tree_hash()
            treehashWalletPlayer = WalletPlayerMod.get_tree_hash()
            wallet_puzzle_hash = treehashWalletPlayer.hex()
            game_puzzle_hash = treehashOpenGamePlayer.hex()
            wallet_address = encode_puzzle_hash(treehashWalletPlayer, self.CHIA_PREFIX)
            return {"success":True,
                    "oracle_puzzle_hash":PlayerOracleMod.get_tree_hash().hex(),
                    "game_puzzle_hash":game_puzzle_hash,
                    "wallet_address": wallet_address, 
                    "wallet_puzzle_hash": wallet_puzzle_hash,
                    "wallet_puzzle_reveal": WalletPlayerMod.__str__(),
                    "wallet_puzzle_reveal_disassembled":disassemble(WalletPlayerMod),
                    "game_puzzle_reveal": GamePlayerMod.__str__(),
                    "game_puzzle_reveal_disassembled":disassemble(GamePlayerMod),
                    "genesis_challenge":self.GENESIS_CHALLENGE_HEX}
        except Exception as e:
            return {"success":False, "error": str(e)}
        
    async def getWalletBalance(self, walletPuzzleHash: str):
        try:
            coins = await self.getUnspentCoinsWithIds(walletPuzzleHash)
            balance = 0
            for coin in coins:
                balance += coin["amount"]
            return {"success": True, "balance": balance, "coins": coins,"isMainnet":self.IS_MAINNET}
        except Exception as e:
            return {"success": False, "message": str(e)}
        
    async def convertAddressToPuzzleHash(self, address: str):
        try:
            puzzle_hash = decode_puzzle_hash(address).hex()
            return {"success": True, "puzzle_hash": puzzle_hash}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def sha256Hex(self, message_hex: str):
        try:
            message_hash = std_hash(bytes.fromhex(message_hex)).hex()
            return {"success": True, "message_hash": message_hash}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def cashOutCoin(self,pubKeyHex:str, coinId:str, cashOutAddress: str, signature:str, fee:int):
        try:
            spend = await self.createSpendCashOutCoin(pubKeyHex, coinId, cashOutAddress, fee)
            signature_bytes = bytes.fromhex(signature)
            aggregated_signature = G2Element.from_bytes(signature_bytes)
            spend_bundle = SpendBundle([spend], aggregated_signature)
            status = await self.pushTx(spend_bundle)
            if status["success"] == False:
                return {"success": False, "message": self.parseError(status["message"])}
            return {"success": True, "message": "Spend bundle added to mempool, wait for the confirmation", "status": status}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)}
    async def createSpendCashOutCoin(self, publicKeyPlayerHex:str, coinId:str, cashOutAddressHash: str, fee:int):
        try:
            publicKeyPlayer = G1Element.from_bytes(bytes.fromhex(publicKeyPlayerHex))
            WalletPlayerMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer)
            coin = await self.getCoin(coinId)
            solution = Program.to([
                self.CASH_OUT_ACTION,
                coin.puzzle_hash, 
                coin.amount,
                fee, 
                bytes.fromhex(cashOutAddressHash), 
                0,
                0,
                bytes.fromhex(cashOutAddressHash),
                0])
            spend = CoinSpend(
                coin,
                SerializedProgram.from_program(WalletPlayerMod),
                SerializedProgram.from_program(solution)
            )
            return spend
        except Exception as e:
            raise e
    def XCHtoMojo(self, xch: float):
        try:
            return int(xch * 1000000000000)
        except Exception as e:
            return None
    def MojoToXCH(self, mojo: int):
        try:
            xch = mojo / 1000000000000
            return format(xch, '.12f')  
        except Exception as e:
            return None
    async def getCoinPendingTransaction(self, coinId: str):
        try:
            full_node_client = await FNClient.getClient()
            mempool_items = await full_node_client.get_all_mempool_items()
            coin_spends = None
            spend_bundle = None

            for item in mempool_items.values():
                for coin_spend in item['spend_bundle']['coin_spends']:
                    if await self.calculateCoinId(coin_spend['coin']['parent_coin_info'], coin_spend['coin']['puzzle_hash'], coin_spend['coin']['amount']) == coinId:
                        coin_spends = coin_spend
                        spend_bundle = item['spend_bundle']
                        break
                if coin_spends:
                    break

            if coin_spends:
                curriedParams = await self.getPuzzleRevealCurriedParams(Program.fromhex(coin_spends['puzzle_reveal']).uncurry()[1])
                solutionParams = await self.getSolutionParams(Program.fromhex(coin_spends['solution']))
                action = "--"
                if len(curriedParams["curriedParams"]) == 1:  # means is Wallet Game
                    if solutionParams["params"][0] == "":
                        action = "Cashing Out Coin From Game Wallet"
                    elif solutionParams["params"][0] == "01":
                        action = "Opening Game...Player 1, Bet: " + str(self.MojoToXCH(int(solutionParams["params"][5], 16)))
                    elif solutionParams["params"][0] == "02":
                        action = "Entering Game...Player 2 Bet: " + str(self.MojoToXCH(int(solutionParams["params"][5], 16)))
                else:
                    if int(solutionParams["params"][-3], 16) == self.ACTION_JOIN_PLAYER1:
                        action = "Player 1 Joining Game"
                    elif int(solutionParams["params"][-3], 16) == self.ACTION_JOIN_PLAYER2:
                        action = "Player 2 Joining Game"
                    elif int(solutionParams["params"][-3], 16) == self.ACTION_CLOSE_GAME:
                        action = "Player 1 Closing Game"
                    elif int(solutionParams["params"][-3], 16) == self.ACTION_REVEAL:
                        action = "Player 1 Revealing"
                    elif int(solutionParams["params"][-3], 16) == self.ACTION_CLAIM_PLAYER2:
                        action = "Player 2 Claiming Win"

                return {
                    "success": True,
                    "message": "Pending transaction found",
                    "action": action,
                    "pendingTransaction": [item],
                    "spendBundle": spend_bundle,
                    "coin": coin_spends["coin"],
                }
            else:
                return {"success": True, "message": "No pending transaction found", "pendingTransaction": []}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    def getEmoji(self,selection:int):
        if selection == 1:
            return "🪨"
        elif selection == 2:
            return "📄"
        elif selection == 3:
            return "✂️"
        else:
            return "❓"
    async def getWinnerLabel(self,selectionPlayer1:int,selectionPlayer2:int):
        if selectionPlayer1 == selectionPlayer2:
            return "Tie"
        elif selectionPlayer1 == 1 and selectionPlayer2 == 3:
            return "Winner Player 1"
        elif selectionPlayer1 == 2 and selectionPlayer2 == 1:
            return "Winner Player 1"
        elif selectionPlayer1 == 3 and selectionPlayer2 == 2:
            return "Winner Player 1"
        else:
            return "Winner Player 2"
    async def getWinnerPublicKey(self,selectionPlayer1:int,selectionPlayer2:int,publicKeyPlayer1:str,publicKeyPlayer2:str):
        if selectionPlayer1 == selectionPlayer2:
            return None
        elif selectionPlayer1 == 1 and selectionPlayer2 == 3:
            return publicKeyPlayer1
        elif selectionPlayer1 == 2 and selectionPlayer2 == 1:
            return publicKeyPlayer1
        elif selectionPlayer1 == 3 and selectionPlayer2 == 2:
            return publicKeyPlayer1
        else:
            return publicKeyPlayer2
    async def getGameStageInfo(self,coinRecord:CoinRecord):
        try:
            if coinRecord.spent_block_index != 0:
                puzzleAndSolution = await self.getPuzzleAndSolution(coinRecord.coin.name().hex(), coinRecord.spent_block_index)
                infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
            else:
                puzzleAndSolution = await self.getPuzzleAndSolution(coinRecord.coin.parent_coin_info.hex(), coinRecord.confirmed_block_index)
                infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
            infoStage = await self.getGameStageParsed(puzzleAndSolution.puzzle_reveal.to_program().uncurry()[1],infoSolutionParams["params"],coinRecord.spent_block_index != 0)
            return infoStage
        except Exception as e:
            return None
    async def getGameDetails(self, coinId:str):
        try:
            coinRecord = await self.getCoinRecord(coinId)
            coinResponse = coinRecord.to_json_dict()
            stageInfo = await self.getGameStageInfo(coinRecord)
            coinResponse["gameParams"] = stageInfo["gameParams"]
            gameCoins = await self.getGameCoins(coinRecord,coinResponse["gameParams"]["publicKeyPlayer1"])
            

            coinResponse["coinStage"] = stageInfo["stage"]
            coinResponse["timestamp"] = coinRecord.timestamp
            coinResponse["date"] = datetime.datetime.fromtimestamp(coinRecord.timestamp).strftime('%d %b %Y %H:%M') + " hrs"
            coinResponse["stageName"] = stageInfo["stageName"]
            coinResponse["gamePuzzleHash"] =  coinRecord.coin.puzzle_hash.hex()
            coinResponse["gamePuzzleReveal"] = stageInfo["GameMod"].__str__()
            coinResponse["gamePuzzleRevealDisassembled"] = disassemble(stageInfo["GameMod"])
            if coinResponse["coinStage"] == 3:
                coinResponse["gameParams"]["selectionPlayer2"] = "Reveal P1 to see"
                coinResponse["gameParams"]["emojiSelectionPlayer2"] = self.getEmoji(0)
            
            coinResponse["gameStatus"] = gameCoins[-1]["stageName"]
            coinResponse["gameCoins"] = gameCoins
            return {"success": True, "coinRecord": coinResponse}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def createSpendClaimGame(self, coinId:str,fee:int):
        try:
            gameCoin = await self.getCoinRecord(coinId)
            puzzleAndSolution = await self.getPuzzleAndSolution(gameCoin.coin.parent_coin_info.hex(), gameCoin.confirmed_block_index)
            infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
            infoStage = await self.getGameStageParsed(puzzleAndSolution.puzzle_reveal.to_program().uncurry()[1],infoSolutionParams["params"])
            gameParams = await self.getGameParams(infoStage["stage"],infoStage["curriedParams"],infoSolutionParams["params"])
            publicOracleCoin,player1OracleCoin,player2OracleCoin = await self.getGameOracleCoins(gameCoin,std_hash(infoStage["GameMod"].get_tree_hash()).hex(),gameParams["publicKeyPlayer1"],gameParams["publicKeyPlayer2"])
            solutionGame = Program.to([
                    1,
                    1,
                    self.ACTION_CLAIM_PLAYER2,
                    gameCoin.coin.amount,
                    fee])
            spendGame = CoinSpend(
                gameCoin.coin,
                SerializedProgram.from_program(infoStage["GameMod"]),
                SerializedProgram.from_program(solutionGame)
            )
            publicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            solutionPublicOracle = Program.to([gameCoin.coin.name()])
            spendPublicOracle = CoinSpend(
                publicOracleCoin.coin,
                SerializedProgram.from_program(publicOracleMod),
                SerializedProgram.from_program(solutionPublicOracle)
            )
            player1OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,bytes.fromhex(gameParams["publicKeyPlayer1"]),self.GAME_MOD.get_tree_hash())
            solutionPlayer1Oracle = Program.to([gameCoin.coin.name()])
            spendPlayer1Oracle = CoinSpend(
                player1OracleCoin.coin,
                SerializedProgram.from_program(player1OracleMod),
                SerializedProgram.from_program(solutionPlayer1Oracle)
            )
            player2OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,bytes.fromhex(gameParams["publicKeyPlayer2"]),self.GAME_MOD.get_tree_hash())
            solutionPlayer2Oracle = Program.to([gameCoin.coin.name()])
            spendPlayer2Oracle = CoinSpend(
                player2OracleCoin.coin,
                SerializedProgram.from_program(player2OracleMod),
                SerializedProgram.from_program(solutionPlayer2Oracle)
            )
            return [spendGame,spendPublicOracle,spendPlayer1Oracle,spendPlayer2Oracle]
        except Exception as e:
            raise e
    async def getFeeEstimateClaimGame(self, coinId:str):
        try:
            full_node_client = await FNClient.getClient()
            spend = await self.createSpendClaimGame(coinId, 0)
            created_coins1, cost1 = compute_additions_with_cost(spend[0])
            created_coins2, cost2 = compute_additions_with_cost(spend[1])
            created_coins3, cost3 = compute_additions_with_cost(spend[2])
            created_coins4, cost4 = compute_additions_with_cost(spend[3])
            infoFee = await full_node_client.get_fee_estimate(target_times=[60, 300, 600], cost= cost1 + cost2 + cost3+ cost4)
            return {"success": True, "infoFee": infoFee}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)} 
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def getCoinStatus(self, coinRecord:CoinRecord):
        if coinRecord.spent_block_index != 0:
            puzzleAndSolution = await self.getPuzzleAndSolution(coinRecord.coin.name().hex(), coinRecord.spent_block_index)
            infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
        else:
            puzzleAndSolution = await self.getPuzzleAndSolution(coinRecord.coin.parent_coin_info.hex(), coinRecord.confirmed_block_index)
            infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
        infoStage = await self.getGameStageParsed(puzzleAndSolution.puzzle_reveal.to_program().uncurry()[1],infoSolutionParams["params"])
        actionSolution = infoSolutionParams["params"][-3]
        actionSolution = int(actionSolution, 16)
        if coinRecord.spent_block_index != 0:
            if actionSolution == self.ACTION_JOIN_PLAYER1:
                infoStage["stageName"] = "Player 1 joined"
            elif actionSolution == self.ACTION_JOIN_PLAYER2:
                infoStage["stageName"] = "Player 2 joined"
            elif actionSolution == self.ACTION_CLOSE_GAME:
                infoStage["stageName"] = "Game closed by player 1"
            elif actionSolution == self.ACTION_REVEAL:
                infoStage["stageName"] = "Revealed by player 1"
            elif actionSolution == self.ACTION_CLAIM_PLAYER2:
                infoStage["stageName"] = "Claim win by player 2, player 1 did not reveal"
        return infoStage["stageName"]
    async def getGameCoins(self, coinRecordPivot:CoinRecord, publicKeyPlayer1:str):
        try:
            jsonGameCoins = []
            publicKeyP1 = G1Element.from_bytes(bytes.fromhex(publicKeyPlayer1))
            player1WalletMod = self.GAME_WALLET_MOD.curry(publicKeyP1)
            player1OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyP1,self.GAME_MOD.get_tree_hash())
            gameParentCoins = await self.getGameParentCoins(coinRecordPivot,player1WalletMod)
            gameChildCoins = await self.getGameChildCoins(coinRecordPivot,player1OracleMod)
            allGameCoins = gameParentCoins + gameChildCoins
            for coinRecord in allGameCoins:
                infoStage = await self.getGameStageInfo(coinRecord)
                formatedCoin = {
                    'parent_coin_info': coinRecord.coin.parent_coin_info.hex(),
                    'puzzle_hash': coinRecord.coin.puzzle_hash.hex(),
                    'amount': coinRecord.coin.amount,
                    'coin_id': coinRecord.coin.name().hex(),
                    'confirmed_block_index': coinRecord.confirmed_block_index,
                    'spent_block_index': coinRecord.spent_block_index,
                    'coinbase': coinRecord.coinbase,
                    'timestamp': coinRecord.timestamp,
                    'date': datetime.datetime.fromtimestamp(coinRecord.timestamp).strftime('%d %b %Y %H:%M') + " hrs",
                    'stage': infoStage["stage"],
                    'stageName': infoStage["stageName"],
                }
                jsonGameCoins.append(formatedCoin)
            return jsonGameCoins
        except Exception as e:
            return []
    async def getGameChildCoins(self, coinRecord:CoinRecord, player1OracleMod:Program):
        try:
            closeHash = std_hash(player1OracleMod.get_tree_hash())
            parentCoin = coinRecord
            coins = []
            while parentCoin and parentCoin.spent_block_index != 0 and len(coins) < 10:
                childCoins = await self.getCoinRecordsByParentIds([parentCoin.coin.name()], True)
                if any(childCoin.coin.puzzle_hash == closeHash for childCoin in childCoins):
                    break
                childCoins = [childCoin for childCoin in childCoins if childCoin.coin.amount != 0]
                if childCoins:
                    coins.append(childCoins[0])
                    parentCoin = childCoins[0]
                else:
                    break
            return coins
        except Exception as e:
            return []
    async def getGameParentCoins(self, coinRecord:CoinRecord, player1WalletMod:Program):
        try:
            coins = [coinRecord]
            parentCoin = await self.getCoinRecord(coinRecord.coin.parent_coin_info.hex())
            while parentCoin.coin.puzzle_hash.hex() != player1WalletMod.get_tree_hash().hex() and len(coins) < 10:
                coins.append(parentCoin)
                parentCoin = await self.getCoinRecord(parentCoin.coin.parent_coin_info.hex())
            coins.reverse()
            return coins
        except Exception as e:
            return []
    async def getGameParams(self, stage:int, curriedParams: list, solutionParams: list):
        try:
            Response = {}
            Response["publicKeyPlayer1"] = curriedParams[4]
            Response["publicKeyPlayer2"] = "----"
            Response["compromisePlayer1"] = ""
            Response["puzzleHashPlayer1"] = ""
            Response["selectionPlayer2"] = "----"
            Response["emojiSelectionPlayer2"] = self.getEmoji(0)
            Response["emojiSelectionPlayer1"] = self.getEmoji(0)
            Response["puzzleHashPlayer2"] = "----"
            Response["player2OraclePuzzleHash"] = ""
            Response["selectionPlayer1"] = ""
            Response["secretKeyPlayer1"] = ""
            Response["player2WalletPuzzleHash"] = "----"
            if stage == 2:
                Response["compromisePlayer1"] = solutionParams[0]
                Response["puzzleHashPlayer1"] = solutionParams[1]
            elif stage == 3:
                Response["compromisePlayer1"] = curriedParams[5]
                Response["puzzleHashPlayer1"] = curriedParams[6]
                Response["player2WalletPuzzleHash"] = solutionParams[0]
                Response["publicKeyPlayer2"] = solutionParams[1]
                Response["selectionPlayer2"] = solutionParams[2]
                Response["emojiSelectionPlayer2"] = self.getEmoji(int(solutionParams[2], 16) if solutionParams[2].isdigit() else 0)
                Response["puzzleHashPlayer2"] = solutionParams[3]
                Response["player2OraclePuzzleHash"] = solutionParams[4]
            elif stage == 4:
                Response["compromisePlayer1"] = curriedParams[5]
                Response["puzzleHashPlayer1"] = curriedParams[6]
                Response["player2WalletPuzzleHash"] = curriedParams[7]
                Response["publicKeyPlayer2"] = curriedParams[8]
                Response["selectionPlayer2"] = curriedParams[9]
                Response["emojiSelectionPlayer2"] = self.getEmoji(int(curriedParams[9], 16) if curriedParams[9].isdigit() else 0)
                Response["puzzleHashPlayer2"] = curriedParams[10]
                Response["player2OraclePuzzleHash"] = curriedParams[11]
                Response["selectionPlayer1"] = solutionParams[0]
                Response["emojiSelectionPlayer1"] = self.getEmoji(int(solutionParams[0], 16) if solutionParams[0].isdigit() else 0)
                Response["secretKeyPlayer1"] = solutionParams[1]
            return Response
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getSolutionParams(self, program: Program):
        try:
            params = []
            while program.__str__() != "" and program.__str__() != "80":
                params.append(program.first().as_atom().hex())
                program = program.rest()
            return {"success": True, "params": params}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getPuzzleRevealCurriedParams(self, puzzleReveal: Program):
        try:
            curriedParams = []
            while puzzleReveal != "":
                curriedParams.append(puzzleReveal.first().as_atom().hex())
                puzzleReveal = puzzleReveal.rest()
            return {"success": True, "curriedParams": curriedParams}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getGameStageParsed(self, programCurriedParams: Program, solutionParams: list,isSpent:bool = False):
        try:
            curriedParams = []
            stage = 1
            stageName = "Waiting for player 1"
            publicKeyWinner = ""
            gameResult = ""
            actionSolution = solutionParams[-3]
            actionSolution = int(actionSolution, 16)
            while programCurriedParams != "":
                curriedParams.append(programCurriedParams.first().as_atom().hex())
                programCurriedParams = programCurriedParams.rest()
            if len(curriedParams) == 5:
                stage = 2
                stageName = "Waiting for player 2"
                
                newCurriedParams = curriedParams
                newCurriedParams.append(solutionParams[0])
                newCurriedParams.append(solutionParams[1])
                byteCurriedParams = [bytes.fromhex(item) for item in curriedParams]
                GameMod = self.GAME_MOD.curry(*byteCurriedParams)
            elif len(curriedParams) == 7:
                stage = 3
                stageName = "Waiting for player 1 to reveal selection"
                newCurriedParams = curriedParams
                newCurriedParams.append(solutionParams[0])
                newCurriedParams.append(solutionParams[1])
                newCurriedParams.append(solutionParams[2])
                newCurriedParams.append(solutionParams[3])
                newCurriedParams.append(solutionParams[4])
                byteCurriedParams = [bytes.fromhex(item) for item in curriedParams]
                GameMod = self.GAME_MOD.curry(*byteCurriedParams)
            elif len(curriedParams) == 12:
                stage = 4
                stageName = "Game completed"
                newCurriedParams = curriedParams
                byteCurriedParams = [bytes.fromhex(item) for item in curriedParams]
                GameMod = self.GAME_MOD.curry(*byteCurriedParams)
            gameParams = await self.getGameParams(stage,curriedParams,solutionParams)
            if isSpent:
                if actionSolution == self.ACTION_JOIN_PLAYER1:
                    stageName = "Player 1 joined"
                elif actionSolution == self.ACTION_JOIN_PLAYER2:
                    stageName = "Player 2 joined"
                elif actionSolution == self.ACTION_CLOSE_GAME:
                    stageName = "Game closed by player 1"
                    gameResult = "CLOSED"
                elif actionSolution == self.ACTION_REVEAL:
                    gameResult = "REVEALED"
                    intSelectionPlayer1 = int(gameParams["selectionPlayer1"], 16)
                    intSelectionPlayer2 = int(gameParams["selectionPlayer2"], 16)
                    publicKeyWinner = await self.getWinnerPublicKey(intSelectionPlayer1,intSelectionPlayer2,gameParams["publicKeyPlayer1"],gameParams["publicKeyPlayer2"])
                    stageName = "Player 1 Revealed: " + await self.getWinnerLabel(intSelectionPlayer1,intSelectionPlayer2)+" "+self.getEmoji(intSelectionPlayer1)+" vs "+self.getEmoji(intSelectionPlayer2)
                elif actionSolution == self.ACTION_CLAIM_PLAYER2:
                    gameResult = "CLAIMED"
                    publicKeyWinner = gameParams["publicKeyPlayer2"]
                    stageName = "Claim win by player 2, player 1 did not reveal"
            return {"success": True, "stage": stage,"gameResult":gameResult,"stageName":stageName,"publicKeyWinner":publicKeyWinner ,"curriedParams": curriedParams,"GameMod": GameMod,"gameParams":gameParams}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def createSpendCloseGame(self, coinId:str, fee:int):
        try:
            gameCoin = await self.getCoinRecord(coinId)
            puzzleAndSolution = await self.getPuzzleAndSolution(gameCoin.coin.parent_coin_info.hex(), gameCoin.confirmed_block_index)
            infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
            infoStage = await self.getGameStageParsed(puzzleAndSolution.puzzle_reveal.to_program().uncurry()[1],infoSolutionParams["params"])
            gameParams = await self.getGameParams(infoStage["stage"],infoStage["curriedParams"],infoSolutionParams["params"])
            publicOracleCoin,player1OracleCoin,player2OracleCoin = await self.getGameOracleCoins(gameCoin,std_hash(infoStage["GameMod"].get_tree_hash()).hex(),gameParams["publicKeyPlayer1"])
            solutionGame = Program.to([
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    self.ACTION_CLOSE_GAME,
                    gameCoin.coin.amount,
                    fee])
            spendGame = CoinSpend(
                gameCoin.coin,
                SerializedProgram.from_program(infoStage["GameMod"]),
                SerializedProgram.from_program(solutionGame)
            )
            publicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            solutionPublicOracle = Program.to([gameCoin.coin.name()])
            spendPublicOracle = CoinSpend(
                publicOracleCoin.coin,
                SerializedProgram.from_program(publicOracleMod),
                SerializedProgram.from_program(solutionPublicOracle)
            )
            playerOracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,bytes.fromhex(gameParams["publicKeyPlayer1"]),self.GAME_MOD.get_tree_hash())
            solutionPlayerOracle = Program.to([gameCoin.coin.name()])
            spendPlayerOracle = CoinSpend(
                player1OracleCoin.coin,
                SerializedProgram.from_program(playerOracleMod),
                SerializedProgram.from_program(solutionPlayerOracle)
            )
            return [spendGame,spendPublicOracle,spendPlayerOracle]
        except Exception as e:
            raise e
    async def getGameOracleCoins(self, gameCoin:CoinRecord,gameModHash:str,publicKeyPlayer1Hex:str,publicKeyPlayer2Hex = None):
        PublicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
        publicKeyPlayer1 = G1Element.from_bytes(bytes.fromhex(publicKeyPlayer1Hex))
        if publicKeyPlayer2Hex:
            publicKeyPlayer2 = G1Element.from_bytes(bytes.fromhex(publicKeyPlayer2Hex))
            Player2OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer2,self.GAME_MOD.get_tree_hash())
        Player1OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer1,self.GAME_MOD.get_tree_hash())
        oracleCoins = await self.getCoinRecordByHint(gameCoin.confirmed_block_index,gameModHash,False)
        player2OracleCoin = None
        if oracleCoins == None or len(oracleCoins) == 0:
            raise Exception("Oracle Games coins not found")
        publicOracleCoin = [coin for coin in oracleCoins if coin.coin.puzzle_hash == PublicOracleMod.get_tree_hash()][0]
        player1OracleCoin = [coin for coin in oracleCoins if coin.coin.puzzle_hash == Player1OracleMod.get_tree_hash()][0]
        if publicKeyPlayer2Hex:
            player2OracleCoin = [coin for coin in oracleCoins if coin.coin.puzzle_hash == Player2OracleMod.get_tree_hash()][0]
        return [publicOracleCoin,player1OracleCoin,player2OracleCoin]
    async def getPublicOracleCoin(self, gameCoin:CoinRecord,gameModHash:str):
        try:
            PublicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            publicOracleCoin = await self.getCoinRecordByHint(gameCoin.confirmed_block_index,gameModHash,False)
            if publicOracleCoin == None or len(publicOracleCoin) == 0:
                raise Exception("Public Oracle Game coin not found")
            publicOracleCoin = [coin for coin in publicOracleCoin if coin.coin.puzzle_hash == PublicOracleMod.get_tree_hash()][0]
            return publicOracleCoin
        except Exception as e:
            raise e
    async def getPlayer1OracleCoin(self, gameCoin:str,publicKey:str,gameModHash:str):
        try:
            publicKeyPlayer1 = G1Element.from_bytes(bytes.fromhex(publicKey))
            PlayerOracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,publicKeyPlayer1,self.GAME_MOD.get_tree_hash())
            playerOracleCoin = await self.getCoinRecordByHint(gameCoin.confirmed_block_index,gameModHash,False)

            if playerOracleCoin == None or len(playerOracleCoin) == 0:
                raise Exception("Player Oracle Game coin not found")
            playerOracleCoin = [coin for coin in playerOracleCoin if coin.coin.puzzle_hash == PlayerOracleMod.get_tree_hash()][0]
            return playerOracleCoin
        except Exception as e:
            raise e
    async def getFeeEstimateCloseGame(self,  coinId:str, fee:int ):
        try:
            full_node_client = await FNClient.getClient()
            spend = await self.createSpendCloseGame( coinId, fee)
            created_coins, cost = compute_additions_with_cost(spend[0])
            created_coins2, cost2 = compute_additions_with_cost(spend[1])
            created_coins3, cost3 = compute_additions_with_cost(spend[2])
            fee = await full_node_client.get_fee_estimate(target_times=[60, 300, 600], cost=cost+cost2+cost3)
            return {"success": True, "infoFee": fee}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)} 
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    def parseError(self, e):
        try:
            response = str(e)
            jsonPart = response.split(": ", 1)[1]
            parsedResponse = json.loads(jsonPart)

            if "ASSERT_SECONDS_RELATIVE_FAILED" in parsedResponse["error"]:
                return "You need to wait 24 hrs for this action"
            
            
            return parsedResponse["error"]
        except Exception as e:
            return str(e)
    async def claimGame(self, coinId:str, fee:int, signature:str):
        try:
            spend = await self.createSpendClaimGame(coinId, fee)
            gameCoin = spend[0].coin
            publicOracleCoin = spend[1].coin
            playerOracleCoin = spend[2].coin
            player2OracleCoin = spend[3].coin

            signature_bytes = bytes.fromhex(signature)
            signatureP2 = G2Element.from_bytes(signature_bytes)

            signServerPublic: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + publicOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer1: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + playerOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer2: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + player2OracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            aggregated_signature = AugSchemeMPL.aggregate([signatureP2, signServerPublic,signServerPlayer1,signServerPlayer2])
            spend_bundle = SpendBundle(spend, aggregated_signature)
            status = await self.pushTx(spend_bundle)
            if status["success"] == False:
                return {"success": False, "message": self.parseError(status["error"])}
            return {"success": True, "message": "Instruction added to mempool", "status": status}
        except Exception as e:
            try:
                data_dict = ast.literal_eval(str(e))
                error_message = data_dict['error']  
                return {"success": False, "message": error_message}
            except Exception as e:
                print(e)
                return {"success": False, "message": str(e)}
    async def closeGame(self, coinId:str, fee:int, signature:str):
        try:
            spend = await self.createSpendCloseGame(coinId, fee)
            coinGame = spend[0].coin
            publicOracleCoin = spend[1].coin
            playerOracleCoin = spend[2].coin

            signature_bytes = bytes.fromhex(signature)
            signatureP1 = G2Element.from_bytes(signature_bytes)

            signServerPublic: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(coinGame.name())
                            + publicOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer1: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(coinGame.name())
                            + playerOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            aggregated_signature = AugSchemeMPL.aggregate([signatureP1, signServerPublic,signServerPlayer1])
            spend_bundle = SpendBundle(spend, aggregated_signature)
            status = await self.pushTx(spend_bundle)
            if status["success"] == False:
                return {"success": False, "message": self.parseError(status["error"])}
            return {"success": True, "message": "Instruction added to mempool", "status": status}
        except Exception as e:
            try:
                data_dict = ast.literal_eval(str(e))
                error_message = data_dict['error']  
                return {"success": False, "message": error_message}
            except Exception as e:
                print(e)
                return {"success": False, "message": str(e)}
    async def createSpendRevealSelectionPlayer1WithFee(self, publicKeyPlayer1Hex:str, coinId:str, selection:str, revealKey:str, fee:int, coinIdWallet:str):
        try:
            spendGame,spendPublicOracle,spendPlayer1Oracle,spendPlayer2Oracle = await self.createSpendRevealSelectionPlayer1(coinId, selection, revealKey)
            publicKeyPlayer1 = G1Element.from_bytes(bytes.fromhex(publicKeyPlayer1Hex))
            player1WalletMod = self.GAME_WALLET_MOD.curry(publicKeyPlayer1)
            coinWallet = await self.getCoin(coinIdWallet)
            solutionWallet = Program.to([
                self.ACTION_WALLET_SET_FEE,
                coinWallet.puzzle_hash, 
                coinWallet.amount,
                fee, 
                spendGame.coin.puzzle_hash, 
                1,
                selection,
                spendGame.coin.puzzle_hash,
                spendGame.coin.puzzle_hash])
            spendWallet = CoinSpend(
                coinWallet,
                SerializedProgram.from_program(player1WalletMod),
                SerializedProgram.from_program(solutionWallet)
            )
            return [spendGame,spendPublicOracle,spendPlayer1Oracle,spendPlayer2Oracle,spendWallet]
        except Exception as e:
            raise e
    async def createSpendRevealSelectionPlayer1(self, coinId:str, selection:str, revealKey:str):
        try:
            gameCoin = await self.getCoinRecord(coinId)
            puzzleAndSolution = await self.getPuzzleAndSolution(gameCoin.coin.parent_coin_info.hex(), gameCoin.confirmed_block_index)
            infoSolutionParams = await self.getSolutionParams(puzzleAndSolution.solution.to_program())
            infoStage = await self.getGameStageParsed(puzzleAndSolution.puzzle_reveal.to_program().uncurry()[1],infoSolutionParams["params"])
            gameParams = await self.getGameParams(infoStage["stage"],infoStage["curriedParams"],infoSolutionParams["params"])
            publicOracleCoin,player1OracleCoin,player2OracleCoin = await self.getGameOracleCoins(gameCoin,std_hash(infoStage["GameMod"].get_tree_hash()).hex(),gameParams["publicKeyPlayer1"],gameParams["publicKeyPlayer2"])
            solutionGame = Program.to([
                    selection,
                    bytes(revealKey, 'utf-8'),
                    self.ACTION_REVEAL,
                    gameCoin.coin.amount,
                    0])
            spendGame = CoinSpend(
                gameCoin.coin,
                SerializedProgram.from_program(infoStage["GameMod"]),
                SerializedProgram.from_program(solutionGame)
            )
            publicOracleMod = self.PUBLIC_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,self.GAME_MOD.get_tree_hash())
            solutionPublicOracle = Program.to([gameCoin.coin.name()])
            spendPublicOracle = CoinSpend(
                publicOracleCoin.coin,
                SerializedProgram.from_program(publicOracleMod),
                SerializedProgram.from_program(solutionPublicOracle)
            )
            player1OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,bytes.fromhex(gameParams["publicKeyPlayer1"]),self.GAME_MOD.get_tree_hash())
            solutionPlayer1Oracle = Program.to([gameCoin.coin.name()])
            spendPlayer1Oracle = CoinSpend(
                player1OracleCoin.coin,
                SerializedProgram.from_program(player1OracleMod),
                SerializedProgram.from_program(solutionPlayer1Oracle)
            )
            player2OracleMod = self.PLAYER_ORACLE_MOD.curry(self.SERVER_GAME_PUBLIC_KEY,bytes.fromhex(gameParams["publicKeyPlayer2"]),self.GAME_MOD.get_tree_hash())
            solutionPlayer2Oracle = Program.to([gameCoin.coin.name()])
            spendPlayer2Oracle = CoinSpend(
                player2OracleCoin.coin,
                SerializedProgram.from_program(player2OracleMod),
                SerializedProgram.from_program(solutionPlayer2Oracle)
            )
            return [spendGame,spendPublicOracle,spendPlayer1Oracle,spendPlayer2Oracle]
        except Exception as e:
            raise e
    async def getFeeEstimateRevealSelectionPlayer1(self, publicKeyPlayer1Hex:str, coinId:str, coinIdWallet:str,selection:str, revealKey:str):
        try:
            full_node_client = await FNClient.getClient()
            spend = await self.createSpendRevealSelectionPlayer1WithFee(publicKeyPlayer1Hex, coinId, selection, revealKey, 1000, coinIdWallet)
            created_coins1, cost1 = compute_additions_with_cost(spend[0])
            created_coins2, cost2 = compute_additions_with_cost(spend[1])
            created_coins3, cost3 = compute_additions_with_cost(spend[2])
            created_coins4, cost4 = compute_additions_with_cost(spend[3])
            created_coins5, cost5 = compute_additions_with_cost(spend[4])
            fee = await full_node_client.get_fee_estimate(target_times=[60, 300, 600], cost=cost1+cost2+cost3+cost4+cost5)
            return {"success": True, "infoFee": fee}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)} 
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def revealSelectionPlayer1(self, coinId:str, selection:str, revealKey:str,signature:str):
        try:
            spend = await self.createSpendRevealSelectionPlayer1( coinId, selection, revealKey)
            
            gameCoin = spend[0].coin
            publicOracleCoin = spend[1].coin
            player1OracleCoin = spend[2].coin
            player2OracleCoin = spend[3].coin

            signature_bytes = bytes.fromhex(signature)
            signatureP1Game = G2Element.from_bytes(signature_bytes)

            signServerPublic: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + publicOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer1: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + player1OracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer2: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + player2OracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            aggregated_signature = AugSchemeMPL.aggregate([signatureP1Game, signServerPublic,signServerPlayer1,signServerPlayer2])
            spend_bundle = SpendBundle(spend, aggregated_signature)
            status = await self.pushTx(spend_bundle)
            if status["success"] == False:
                return {"success": False, "message": self.parseError(status["message"])}
            return {"success": True, "message": "Spend bundle added to mempool, wait for the confirmation", "status": status}
        except Exception as e:
            if hasattr(e, 'args') and len(e.args) >= 2 and isinstance(e.args[1], str) and all(c in string.hexdigits for c in e.args[1]):
                byte_data = bytes.fromhex(e.args[1])
                decoded_string = byte_data.decode('ISO-8859-1')
                return {"success": False, "message": decoded_string}
            else:
                return {"success": False, "message": str(e)}
    async def revealSelectionPlayer1WithFee(self, publicKeyPlayer1Hex:str, coinId:str, selection:str, revealKey:str,signatureGame:str, coinIdWallet:str,fee:int, signatureWallet:str):
        try:
            spend = await self.createSpendRevealSelectionPlayer1WithFee(publicKeyPlayer1Hex, coinId, selection, revealKey, fee, coinIdWallet)
            gameCoin = spend[0].coin
            publicOracleCoin = spend[1].coin
            player1OracleCoin = spend[2].coin
            player2OracleCoin = spend[3].coin

            signatureBytesWallet = bytes.fromhex(signatureWallet)
            signatureWallet = G2Element.from_bytes(signatureBytesWallet)
            signature_bytes = bytes.fromhex(signatureGame)
            signatureP1Game = G2Element.from_bytes(signature_bytes)

            signServerPublic: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + publicOracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer1: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + player1OracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            signServerPlayer2: G2Element = AugSchemeMPL.sign(self.SERVER_GAME_PRIVATE_KEY,
                            std_hash(gameCoin.name())
                            + player2OracleCoin.name()
                            + self.GENESIS_CHALLENGE
                        )
            aggregated_signature = AugSchemeMPL.aggregate([signatureP1Game, signServerPublic,signServerPlayer1,signServerPlayer2,signatureWallet])
            spend_bundle = SpendBundle(spend, aggregated_signature)
            status = await self.pushTx(spend_bundle)
            if status["success"] == False:
                return {"success": False, "message": self.parseError(status["message"])}
            return {"success": True, "message": "Spend bundle added to mempool, wait for the confirmation", "status": status}
        except Exception as e:
            try:
                data_dict = ast.literal_eval(str(e))
                error_message = data_dict['error']  
                return {"success": False, "message": error_message}
            except Exception as e:
                print(e)
                return {"success": False, "message": str(e)}
    async def getNetworkInfo(self):
        try:
           
            networkInfo = await self.fetch("get_network_info", {})
            return networkInfo
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def verifySignatureLogin(self, publicKey:str,messageLogin:str, signature:str,signingMode:str,address:str):
        try:
            walletClient = await WalletClient.getClient()
            if address == "" or address == None:
                signatureInfo = await walletClient.fetch("verify_signature", {"signing_mode": signingMode, "pubkey": publicKey,"message": messageLogin,"signature": signature})
            else:
                signatureInfo = await walletClient.fetch("verify_signature", {"signing_mode": signingMode, "pubkey": publicKey,"message": messageLogin,"signature": signature,address: address})

            return signatureInfo
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            walletClient.close()
            await walletClient.await_closed()
    async def getBlockChainState(self):
        try:
            full_node_client = await FNClient.getClient()
            blockchainState = await full_node_client.fetch("get_blockchain_state", {})
            return blockchainState
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            full_node_client.close()
            await full_node_client.await_closed()
    async def encodeDID(self, coinId:str):
        try:
            DID = encode_puzzle_hash(bytes.fromhex(coinId), "did:chia:")
            return DID
        except Exception as e:
            return {"success": False, "message": str(e)}
      
    async def configNetwork(self):
        network_info_result = await self.getNetworkInfo()
        if network_info_result["success"]:
            self.CHIA_PREFIX = network_info_result["network_prefix"]
            if network_info_result["network_name"] == "mainnet":
                self.GENESIS_CHALLENGE = bytes.fromhex("ccd5bb71183532bff220ba46c268991a3ff07eb358e8255a65c30a2dce0e5fbb")
                self.GENESIS_CHALLENGE_HEX = self.GENESIS_CHALLENGE.hex()
                self.IS_MAINNET = True
            elif network_info_result["network_name"] == "testnet11":
                self.GENESIS_CHALLENGE = bytes.fromhex("37a90eb5185a9c4439a91ddc98bbadce7b4feba060d50116a067de66bf236615")
                self.GENESIS_CHALLENGE_HEX = self.GENESIS_CHALLENGE.hex()
                self.IS_MAINNET = False
    def convertJsonToSpendBundle(self, jsonSpendBundle:dict):
        try:
            coin_spends = []
            for coin_spend in jsonSpendBundle["coin_spends"]:
                coin = Coin(
                    bytes.fromhex(coin_spend["coin"]["parent_coin_info"].replace("0x", "")),
                    bytes.fromhex(coin_spend["coin"]["puzzle_hash"].replace("0x", "")),
                    uint64(coin_spend["coin"]["amount"])
                )
                puzzle_reveal = SerializedProgram.fromhex(coin_spend["puzzle_reveal"])
                solution = SerializedProgram.fromhex(coin_spend["solution"])
                coin_spends.append(CoinSpend(coin, puzzle_reveal, solution))

            aggregated_signature = G2Element.from_bytes(bytes.fromhex(jsonSpendBundle["aggregated_signature"][0]))

            spend_bundle = SpendBundle(coin_spends, aggregated_signature)
            return spend_bundle
        except Exception as e:
            return SpendBundle([], G2Element())
    async def setMyName(self, pubkey: str, message: str, signature: str, name: str):
        try:
            message = f"Set name: {name}"
            verification_result = await self.verifySignatureLogin(pubkey, message, signature, "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_AUG:CHIP-0002_", "")
            if verification_result["success"]:
                self.GameDatabase.setUserName(pubkey, name)
                return {"success": True, "message": "Name updated and signature verified"}
            else:
                return {"success": False, "message": "Signature verification failed"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def getUserName(self, pubkey: str):
        try:
            name = self.GameDatabase.getUserName(pubkey)
            if len(name) > 30:
                return {"success": True, "name": name[:30]+"...", "fullname": name}
            return {"success": True, "name": name}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def registerFirebaseToken(self, pubkey: str, token: str):
        try:
            self.GameDatabase.setFirebaseToken(pubkey, token)
            return {"success": True, "message": "Token registered"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    async def sendNotificationtoPubkey(self, pubkey: str, title: str, body: str , action_url: str):
        token = self.GameDatabase.getTokenFromPublicKey(pubkey)
        if token is None or token == "":
            return {"success": False, "message": "Token not found"}
        await self.Firebase.send_notification(
                token=token,
                title=title,
                message=body,
                action_url=action_url,
                additional_data=None
            )
    async def fetch(self, endpoint: str, data: dict):
        try:
            url = f"{self.urlApi}/{endpoint}"
            response = requests.post(url, json=data)
            return response.json()
        except Exception as e:
            return {"success": False, "message": str(e)}