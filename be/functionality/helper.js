const ABI = require('../abis');
const { coinList } = require('../functionality/constants');
const graphql = require('../graphql/index');

const {
    w_getWeb3InstanceHTTP,
    w_getWeb3InstanceWSS
} = require('./web3');

const {
    r_getRedis
} = require('./redis');

// instance của web3
const web3_http = w_getWeb3InstanceHTTP();
const web3_wss = w_getWeb3InstanceWSS();

async function h_getTokenByAddress(token) {

    try {
        let token0 = JSON.parse(await r_getRedis().get(token.toString())) || {};
        if (Object.keys(token0).length === 0) {
            const contract = new web3_http.eth.Contract(ABI.getABIToken(), token);
            token0 = {
                address: token,
                name: await contract.methods.name().call(),
                symbol: await contract.methods.symbol().call(),
                decimals: (await contract.methods.decimals().call()).toString(),
            }
            await (r_getRedis().set(token.toString(), JSON.stringify(token0)));
        }
        return token0;
    } catch (error) {
        console.log(error);
    }
}

async function h_getTokensPair(select = ['BNB']) {
    return (select.map(x => {
        if (coinList[x]) return coinList[x]
    })).filter(Boolean);
}

async function h_setContract(token_address) {
    return {
        coin: token,
        symbol: '18',
        contract: new web3_http.eth.Contract(ABI.getABIToken(), token_address),
    };
}

async function h_getPrice(reserves, token0, token1, slippageTolerance = 0.5) {
    try {
        const _reserve0 = Number(reserves[0] / BigInt(10n ** BigInt(token0.decimals)));
        const _reserve1 = Number(reserves[1] / BigInt(10n ** BigInt(token1.decimals)));
        const timestamp = reserves[2].toString();
        const toRatio = (Number(_reserve1) / Number(_reserve0) * (1 + slippageTolerance / 100)).toFixed(18);
        const fromRatio = (Number(_reserve0) / Number(_reserve1) * (1 + slippageTolerance / 100)).toFixed(18);

        console.log(`Time: ${timestamp}: ${token0.name} to ${token1.name} Ratio: ${toRatio}`);
        console.log(`Time: ${timestamp}: ${token1.name} to ${token0.name} Ratio: ${fromRatio}`);

        return {
            _reserve0: _reserve0,
            _reserve1: _reserve1,
            toRatio,
            fromRatio,
            timestamp
        }
    } catch (error) {
        console.error("h_getPrice:", error);
    }
}

// using get and push data when init system
async function h_loadTopPairsByGraphql() {
    const response = await graphql.h_getLimitedPairsGraphql(100);
    if (response && response.pairs) {
        const pairs = response.pairs;
        for (let index = 0; index < pairs.length; index++) {
            const pair = pairs[index];
            const key = `${pair.token0.id}-${pair.token1.id}`
            await (r_getRedis().set(key, JSON.stringify(pair)));
        }
    }
    return;
}

// using get and push data when init system
async function h_loadTokenByGraphql() {

    const keys = Object.keys(coinList);
    for (let index = 0; index < keys.length; index++) {
        const response = await graphql.h_getTokenGraphql(coinList[keys[index]]);
        if (response.token) {
            const key = `${response.token.id}`
            await (r_getRedis().set(key, JSON.stringify(response.token)));
        }
    }
    return;
}

module.exports = {
    h_getTokenByAddress,
    h_getTokensPair,
    h_setContract,
    h_getPrice,
    h_loadTopPairsByGraphql,
    h_loadTokenByGraphql
}