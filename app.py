import time
import datetime
import os
from fastapi import Body, FastAPI, Request, HTTPException, Response
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from RPSChiaLisp.RPSDriver import *

hexPrivateKey = os.getenv("HEX_PRIVATE_KEY")
if not hexPrivateKey:
    raise ValueError("The HEX_PRIVATE_KEY environment variable is not set.")
Driver = RPSDriver(hexPrivateKey)
app = FastAPI()
templates = Jinja2Templates(directory='templates')
app.mount("/static", StaticFiles(directory="static"), name="static")

# Function to sync history games periodically
async def syncHistoryGames():
    while True:
        start_time = time.time()
        try:
            print("Initiating sync history games")
            await Driver.syncHistoryGames()
            print("syncHistoryGames executed successfully")
        except Exception as e:
            print(f"Error during syncHistoryGames: {e}")
            
        # Calculate time elapsed and wait remaining time if any
        elapsed = time.time() - start_time
        wait_time = max(30 - elapsed, 0)
        await asyncio.sleep(wait_time)
async def syncOpenGames():
    while True:
        start_time = time.time()
        try:
            print("Initiating sync open games")
            await Driver.syncOpenGames()
            print("syncOpenGames executed successfully")
        except Exception as e:
            print(f"Error during syncHistoryGames: {e}")
            
        # Calculate time elapsed and wait remaining time if any
        elapsed = time.time() - start_time
        wait_time = max(30 - elapsed, 0)
        await asyncio.sleep(wait_time)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(syncHistoryGames())
    asyncio.create_task(syncOpenGames())

#VIews
@app.get("/.well-known/walletconnect.txt")
async def walletconnect(request: Request):
    with open('.well-known/walletconnect.txt', 'r') as file:
        content = file.read()
    return Response(content=content, media_type="text/plain")
@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse('home.html', {"request": request})
@app.get("/myGameWallet")
async def myGameWallet(request: Request):
    return templates.TemplateResponse('myGameWallet.html', {"request": request})
@app.get("/createGame")
async def createGame(request: Request):
    return templates.TemplateResponse('createGame.html', {"request": request})
@app.get("/userOpenGames/{pubkey}")
async def userOpenGames(request: Request):
    return templates.TemplateResponse('userOpenGames.html', {"request": request})
@app.get("/userHistoryGames/{pubkey}")
async def userHistoryGames(request: Request):
    return templates.TemplateResponse('userHistoryGames.html', {"request": request})
@app.get("/historyGames")
async def historyGames(request: Request):
    return templates.TemplateResponse('historyGames.html', {"request": request})
@app.get("/gameDetails/{gameId}")
async def gameDetails(request: Request):
    return templates.TemplateResponse('gameDetails.html', {"request": request})
@app.get("/userProfile/{pubkey}")
async def userProfile(request: Request):
    return templates.TemplateResponse('userProfile.html', {"request": request})
@app.get("/openGames")
async def openGames(request: Request):
    return templates.TemplateResponse('openGames.html', {"request": request})
@app.get("/leaderboard")
async def leaderboard(request: Request):
    return templates.TemplateResponse('leaderboard.html', {"request": request})
#End Views
@app.post("/getLeaderboard")
async def getLeaderboard(request: Request):
    try:
        response = await Driver.getLeaderboard()
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getUserOpenGames")
async def getUserOpenGames(request: Request):
    try:
        data = await request.json()  
        pubkey = data['pubkey'].replace("0x", "")
        response = await Driver.getUserOpenGamesDB(pubkey)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getUserHistoryGames")
async def getUserHistoryGames(request: Request):
    try:
        data = await request.json()  
        pubkey = data['pubkey'].replace("0x", "")
        response = await Driver.getUserHistoryGamesDB(pubkey)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getGlobalStats")
async def getGlobalStats(request: Request):
    try:
        response = await Driver.getGlobalStats()
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getHistoryGames")
async def getHistoryGames(request: Request):
    try:
        response = await Driver.getHistoryGamesDB()
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getOpenGames")
async def getOpenGames(request: Request):
    try:
        response = await Driver.getOpenGamesDB()
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getWalletGameInfo")
async def getWalletGameInfo(request: Request):
    try:
        data = await request.json()  
        pubkey = data['pubkey'].replace("0x", "")
        response = Driver.getWalletGameInfo(pubkey)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "messaged": str(e)})
    
@app.post("/getWalletBalance")
async def getWalletBalance(request: Request):
    try:
        data = await request.json()  
        walletPuzzleHash = data['walletPuzzleHash']
        response = await Driver.getWalletBalance(walletPuzzleHash)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/cashOutCoin")
async def cashOutCoin(request: Request):
    try:
        data = await request.json()  
        coinId = data['coinId']
        cashOutAddress = data['cashOutAddress']
        pubkey = data['pubkey'].replace("0x", "")
        signature = data['signature']
        fee = data['fee']
        response = await Driver.cashOutCoin(pubkey, coinId, cashOutAddress,signature, fee)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/joinPlayer1")
async def joinPlayer1(request: Request):
    try:
        data = await request.json()  
        coinId = data['coinId']
        pubkey = data['pubkey'].replace("0x", "")
        betAmount = data['betAmount']
        puzzleHashPlayer1 = data['puzzleHashPlayer1']
        compromisePlayer1 = data['compromisePlayer1']
        signature = data['signature']
        fee = data['fee']
        response = await Driver.joinPlayer1(pubkey, coinId, fee,betAmount,compromisePlayer1,puzzleHashPlayer1, signature)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/convertAddressToPuzzleHash")
async def convertAddressToPuzzleHash(request: Request):
    try:
        data = await request.json()  
        address = data['address']
        response = await Driver.convertAddressToPuzzleHash(address)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/sha256Hex")
async def sha256Hex(request: Request):
    try:
        data = await request.json()  
        message = data['message']
        response = await Driver.sha256Hex(message)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/concat")
async def concat(request: Request):
    try:
        data = await request.json()  
        params = data['params']
        response = await Driver.concat(params)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getFeeEstimateCashOut")
async def getFeeEstimateCashOut(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        coinId = data['coinId']
        response = await Driver.getFeeEstimateCashOut(pubkey, coinId)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getFeeEstimateJoinPlayer1")
async def getFeeEstimateJoinPlayer1(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        coinId = data['coinId']
        response = await Driver.getFeeEstimateJoinPlayer1(pubkey, coinId)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getFeeEstimateJoinPlayer2")
async def getFeeEstimateJoinPlayer2(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        coinId = data['coinId']
        coinIdWallet = data['coinIdWallet']
        response = await Driver.getFeeEstimateJoinPlayer2(pubkey, coinId,coinIdWallet)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/joinPlayer2")
async def joinPlayer2(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        coinId = data['coinId']
        parentIdWallet = data['parentIdWallet']
        fee = data['fee']
        selection = data['selection']
        puzzleHashPlayer2 = data['puzzleHashPlayer2']
        signature = data['signature']
        spendBundle = Driver.convertJsonToSpendBundle(data['spendBundle'])
        response = await Driver.joinPlayer2(spendBundle,pubkey, coinId, parentIdWallet, fee, selection, puzzleHashPlayer2, signature)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getCoinPendingTransaction")
async def getCoinPendingTransaction(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId'] 
        response = await Driver.getCoinPendingTransaction(coinId)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getGameDetails")
async def getGameDetails(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId']
        response = await Driver.getGameDetailsDB(coinId)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getFeeEstimateCloseGame")
async def getFeeEstimateCloseGame(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId']
        fee = 0
        response = await Driver.getFeeEstimateCloseGame( coinId, fee)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getNetworkInfo")
async def getNetworkInfo(request: Request):
    try:
        response = await Driver.getNetworkInfo()
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/revealSelectionPlayer1")
async def revealSelectionPlayer1(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId']
        selection = data['selection']
        signature = data['signature']
        fee = data['fee']
        pubKey = data['pubkey'].replace("0x", "")
        revealKey = data["revealKey"]
        coinIdWallet = data["coinIdWallet"]
        signatureWallet = data["signatureWallet"]
        if coinIdWallet == None or coinIdWallet == "":
            response = await Driver.revealSelectionPlayer1(coinId, selection,revealKey,signature)
        else:
            response = await Driver.revealSelectionPlayer1WithFee(pubKey,coinId, selection,revealKey,signature,coinIdWallet,fee,signatureWallet)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/revealSelectionPlayer1WithFee")
async def revealSelectionPlayer1WithFee(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId']
        selection = data['selection']
        signature = data['signature']
        fee = data['fee']
        pubKey = data['pubkey'].replace("0x", "")
        revealKey = data["revealKey"]
        coinIdWallet = data["coinIdWallet"]
        signatureWallet = data["signatureWallet"]
        response = await Driver.revealSelectionPlayer1WithFee(pubKey,coinId, selection,revealKey,signature,coinIdWallet,fee,signatureWallet)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getFeeEstimateRevealSelectionPlayer1")
async def getFeeEstimateRevealSelectionPlayer1(request: Request):
    try:
        data = await request.json()
        data = await request.json()
        coinId = data['coinId']
        pubKey = data['pubkey'].replace("0x", "")
        coinIdWallet = data["coinIdWallet"]
        key = data["key"]
        selection = data["selection"]
        response = await Driver.getFeeEstimateRevealSelectionPlayer1(pubKey, coinId, coinIdWallet,selection,key)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getFeeEstimateClaimGame")
async def getFeeEstimateClaimGame(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId']
        response = await Driver.getFeeEstimateClaimGame( coinId)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/claimGame")
async def claimGame(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId']
        signature = data['signature']
        fee = data['fee']
        response = await Driver.claimGame( coinId, fee, signature)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/closeGame")
async def closeGame(request: Request):
    try:
        data = await request.json()
        coinId = data['coinId']
        signature = data['signature']
        fee = data['fee']
        response = await Driver.closeGame( coinId, fee, signature)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getBlockChainState")
async def getBlockChainState(request: Request):
    try:
        response = await Driver.getBlockChainState()
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/verifySignatureLogin")
async def verifySignatureLogin(request: Request):
    try:
        data = await request.json()
        signature = data['signature']
        pubkey = data['pubkey'].replace("0x", "")
        signingMode = data['signingMode']
        address = data['address']
        message = data['message']
        response = await Driver.verifySignatureLogin( pubkey,message,signature, signingMode, address)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/createSolutionCloseGame")
async def createSolutionCloseGame(request: Request):
    try:
        data = await request.json()
        coinAmount = data['coinAmount']
        fee = data['fee']
        response = await Driver.createSolutionCloseGame(coinAmount,fee)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/createSolutionRevealGame")
async def createSolutionRevealGame(request: Request):
    try:
        data = await request.json()
        selection = data['selection']
        revealKey = data['revealKey']
        coinAmount = data['coinAmount']
        response = await Driver.createSolutionRevealGame(selection,revealKey,coinAmount)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/createSolutionClaimGame")
async def createSolutionClaimGame(request: Request):
    try:
        data = await request.json()
        coinAmount = data['coinAmount']
        fee = data['fee']
        response = await Driver.createSolutionClaimGame(coinAmount,fee)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/createSolutionJoinPlayer1")
async def createSolutionJoinPlayer1(request: Request):
    try:
        data = await request.json()
        publicKeyPlayer1 = data['pubkey'].replace("0x", "")
        amount = data['amount']
        selectionHash = data['selectionHash']
        cashOutAddressHash = data['cashOutAddressHash']
        response = await Driver.createSolutionJoinPlayer1(publicKeyPlayer1,amount,selectionHash,cashOutAddressHash)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/createSolutionJoinPlayer2")
async def createSolutionJoinPlayer2(request: Request):
    try:
        data = await request.json()
        publicKeyPlayer2 = data['pubkey'].replace("0x", "")
        selection = data['selection']
        cashOutAddressHash = data['cashOutAddressHash']
        coinId = data['coinId']
        response = await Driver.createSolutionJoinPlayer2(publicKeyPlayer2,coinId,selection,cashOutAddressHash)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/setMyName")
async def setMyName(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        message = data['message']
        signature = data['signature']
        name = data['name']
        response = await Driver.setMyName(pubkey, message, signature, name)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getUserProfile")
async def getUserProfile(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        response = await Driver.getUserProfile(pubkey)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/getUserName")
async def getUserName(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        response = await Driver.getUserName(pubkey)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/registerFirebaseToken")
async def registerFirebaseToken(request: Request):
    try:
        data = await request.json()
        pubkey = data['pubkey'].replace("0x", "")
        token = data['token']
        response = await Driver.registerFirebaseToken(pubkey, token)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.post("/pushTx")
async def pushTx(request: Request):
    try:
        data = await request.json()
        spendBundleJson = data['tx']
        spend_bundle = Driver.convertJsonToSpendBundle(spendBundleJson)
        response = await Driver.pushTx(spend_bundle)
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(content={"success": False, "message": str(e)})
@app.get("/firebase-messaging-sw.js")
async def get_firebase_messaging_sw():
    file_path = "static/js/firebase-messaging-sw.js"
    if os.path.exists(file_path):
        with open(file_path, 'r') as file:
            content = file.read()
        return Response(content=content, media_type="application/javascript")
    else:
        raise HTTPException(status_code=404, detail="File not found")
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app)
