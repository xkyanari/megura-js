const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const { isTestnet } = require('../config.json');

const getUtxos = async (paymentAddress, paymentPublicKey, targetAmount) => {
    let utxos = [];

    try {
        const api_URL = isTestnet === 'true' ? `https://api.blockcypher.com/v1/btc/test3/addrs/${paymentAddress}?unSpentOnly=true&limit=5&confirmations=6&includeScript=true` : `https://api.blockcypher.com/v1/btc/main/addrs/${paymentAddress}?unSpentOnly=true&limit=5&confirmations=6&includeScript=true`;
        const response = await axios.get(api_URL);
        const data = response.data;

        if (data.balance === 0 || data.txrefs === null) {
            throw new Error('No unspent transaction outputs found for this address.');
        }

        const sortedUTXOs = data.txrefs.sort((a, b) => b.value - a.value);

        const network = isTestnet === 'true' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

        const paymentPubkeyBuffer = Buffer.from(paymentPublicKey, 'hex');
        const p2wpkh = bitcoin.payments.p2wpkh({
            pubkey: paymentPubkeyBuffer,
            network,
        });
        const p2sh = bitcoin.payments.p2sh({
            redeem: p2wpkh,
            network,
        });

        let totalValue = 0;

        for (const utxo of sortedUTXOs) {
            if (utxo.tx_output_n !== -1) {
                const utxoObj = {
                    hash: utxo.tx_hash,
                    index: utxo.tx_output_n,
                    witnessUtxo: {
                        script: Buffer.from(utxo.script, 'hex'),
                        value: Number(utxo.value),
                    },
                    redeemScript: p2sh.redeem.output,
                };

                utxos.push(utxoObj);
                totalValue += utxo.value;

                if (totalValue >= targetAmount) {
                    break;
                }
            }
        }

        if (totalValue < targetAmount) {
            throw new Error('Not enough funds in this address to cover the target amount.');
        }
    } catch (error) {
        console.error(`Error in getUtxos function: ${error}`);
        throw error;
    }

    return utxos;
};

module.exports = { getUtxos };