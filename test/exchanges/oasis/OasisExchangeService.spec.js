import contracts from '../../../contracts/contracts';
import { buildTestService } from '../../helpers/serviceBuilders';
import { DAI, WETH } from '../../../src/eth/Currency';

function buildTestOasisExchangeService() {
  return buildTestService('exchange', { exchange: 'OasisExchangeService' });
}

const utils = require('ethers').utils;

function _placeLimitOrder(oasisExchangeService, sellDai) {
  let ethereumTokenService = null;
  ethereumTokenService = oasisExchangeService.get('token');
  const wethToken = ethereumTokenService.getToken(WETH);
  const daiToken = ethereumTokenService.getToken(DAI);
  return wethToken
    .deposit('1')
    .onMined()
    .then(() => {
      const oasisContract = oasisExchangeService
        .get('smartContract')
        .getContractByName(contracts.MAKER_OTC);
      return wethToken.approveUnlimited(oasisContract.getAddress()).onMined();
    })
    .then(() => {
      return wethToken.balanceOf(
        oasisExchangeService.get('web3').defaultAccount()
      );
    })
    .then(() => {
      return daiToken.balanceOf(
        oasisExchangeService.get('web3').defaultAccount()
      );
    })
    .then(() => {
      const wethAddress = wethToken.address();
      const daiAddress = ethereumTokenService.getToken(DAI).address();
      const overrideOptions = { gasLimit: 5500000 };
      if (sellDai) {
        return oasisExchangeService.offer(
          utils.parseEther('0.5'),
          daiAddress,
          utils.parseEther('2.0'),
          wethAddress,
          0,
          overrideOptions
        );
      } else {
        return oasisExchangeService.offer(
          utils.parseEther('0.5'),
          wethAddress,
          utils.parseEther('10.0'),
          daiAddress,
          1,
          overrideOptions
        );
      }
    })
    .then(() => {
      return wethToken.balanceOf(
        oasisExchangeService.get('web3').defaultAccount()
      );
    })
    .then(() => {
      return daiToken.balanceOf(
        oasisExchangeService.get('web3').defaultAccount()
      );
    });
}

function createDaiAndPlaceLimitOrder(oasisExchangeService, sellDai = false) {
  let newCdp, firstInkBalance, firstDaiBalance, defaultAccount;
  let createdCdpService = oasisExchangeService.get('cdp');
  return (
    createdCdpService
      .openCdp()
      .onMined()
      .then(cdp => {
        defaultAccount = createdCdpService
          .get('token')
          .get('web3')
          .defaultAccount();
        //console.log('defaultAccount', defaultAccount);
        newCdp = cdp;
        return Promise.all([
          newCdp.getInfo(),
          createdCdpService
            .get('token')
            .getToken(DAI)
            .balanceOf(defaultAccount)
        ]);
      })
      .then(info => {
        firstInkBalance = parseFloat(info[0].ink);
        firstDaiBalance = parseFloat(info[1].toString());
        //console.log('firstInk', firstInkBalance, 'firstDai', firstDaiBalance);
        return newCdp.lockEth('0.1').then(txn => txn.onMined());
      })

      //.then(() => createdCdpService.get('smartContract').getContractState(contracts.SAI_TUB, 5, true, []))
      //.then(tub => console.log(tub))
      .then(() => newCdp.getInfo())
      .then(info => {
        //console.log(info);
        expect(parseFloat(info.ink)).toBeCloseTo(
          firstInkBalance + 100000000000000000
        );
        return newCdp.drawDai('1').then(txn => txn.onMined());
      })
      .then(() =>
        Promise.all([
          newCdp.getInfo(),
          createdCdpService
            .get('token')
            .getToken(DAI)
            .balanceOf(defaultAccount)
        ])
      )
      .then(result => {
        //console.log(result);
        expect(parseFloat(result[1].toString())).toBeCloseTo(
          firstDaiBalance + 1.0
        );
        return _placeLimitOrder(oasisExchangeService, sellDai);
      })
  );
}

test('sell Dai, console log the balances (used for debugging)', done => {
  const oasisExchangeService = buildTestOasisExchangeService();
  let oasisOrder = null;
  /* eslint-disable-next-line */
  let initialBalance;
  /* eslint-disable-next-line */
  let finalBalance;
  let daiToken = null;

  oasisExchangeService
    .manager()
    .authenticate()
    .then(() => {
      return createDaiAndPlaceLimitOrder(oasisExchangeService);
    })
    .then(() => {
      const oasisContract = oasisExchangeService
        .get('smartContract')
        .getContractByName(contracts.MAKER_OTC);
      return oasisContract.getBestOffer(
        '0x7ba25f791fa76c3ef40ac98ed42634a8bc24c238',
        '0xc226f3cd13d508bc319f4f4290172748199d6612'
      );
    })
    .then(() => {
      const ethereumTokenService = oasisExchangeService.get('token');
      daiToken = ethereumTokenService.getToken(DAI);
      return daiToken.balanceOf(
        oasisExchangeService.get('web3').defaultAccount()
      );
    })
    .then(balance => {
      initialBalance = balance;
      const wethToken = oasisExchangeService.get('token').getToken(WETH);
      return wethToken.balanceOf(
        oasisExchangeService.get('web3').defaultAccount()
      );
    })
    .then(() => {
      const oasisContract = oasisExchangeService
        .get('smartContract')
        .getContractByName(contracts.MAKER_OTC);
      return daiToken.approveUnlimited(oasisContract.getAddress()).onMined();
    })
    .then(() => {
      const oasisContract = oasisExchangeService
        .get('smartContract')
        .getContractByName(contracts.MAKER_OTC);
      return daiToken.allowance(
        oasisExchangeService.get('web3').defaultAccount(),
        oasisContract.getAddress()
      );
    })
    .then(() => {
      oasisOrder = oasisExchangeService.sellDai('0.01', WETH);
      return oasisOrder;
    })
    .then(() => {
      const ethereumTokenService = oasisExchangeService.get('token');
      const token = ethereumTokenService.getToken(WETH);
      return token.balanceOf(oasisExchangeService.get('web3').defaultAccount());
    })
    .then(() => {
      const ethereumTokenService = oasisExchangeService.get('token');
      const token = ethereumTokenService.getToken(DAI);
      return token.balanceOf(oasisExchangeService.get('web3').defaultAccount());
    })
    .then(balance => {
      finalBalance = balance;
      done();
    });
});

test('get fees and fillAmount sell Dai', done => {
  const oasisExchangeService = buildTestOasisExchangeService();
  oasisExchangeService
    .manager()
    .authenticate()
    .then(() => {
      return createDaiAndPlaceLimitOrder(oasisExchangeService);
    })
    .then(() => {
      return oasisExchangeService.sellDai('0.01', WETH);
    })
    .then(order => {
      expect(parseFloat(order.fees(), 10)).toBeGreaterThan(0);
      expect(parseFloat(order.fillAmount(), 10)).toBeGreaterThan(0);
      done();
    });
});

test('get fees and fillAmount buy Dai', done => {
  const oasisService = buildTestOasisExchangeService();
  oasisService
    .manager()
    .authenticate()
    .then(() => {
      return createDaiAndPlaceLimitOrder(oasisService, true);
    })
    .then(() => {
      return oasisService.buyDai('0.01', WETH);
    })
    .then(oasisOrder => {
      expect(parseFloat(oasisOrder.fees(), 10)).toBeGreaterThan(0);
      expect(parseFloat(oasisOrder.fillAmount(), 10)).toBeGreaterThan(0);
      done();
    });
});

/* commenting out until we fix explicit state transations for oasisOrder objects
test('OasisOrder properly finalizes', done => {
  const oasisService = buildTestOasisExchangeService();
  let oasisOrder = null;
  let daiToken = null;
  let randomAddress = TestAccountProvider.nextAddress();
  let order = null;
  oasisService.manager().authenticate()
    .then(() => {
      return createDaiAndPlaceLimitOrder(oasisService);
    })
    .then(() => {
      daiToken = oasisService.get('token').getToken(tokens.DAI);
      const oasisContract = oasisService.get('smartContract').getContractByName(contracts.MAKER_OTC);
      return daiToken.approveUnlimited(oasisContract.getAddress()).onMined();
    })
    .then(() => {
      oasisOrder = oasisService.sellDai('0.01', tokens.WETH);
      order = oasisOrder;
      return oasisOrder.onPending();
    })
    .then(OrderObject => {
      expect(OrderObject._hybrid.getOriginalTransaction().state()).toBe(TransactionState.pending);
      return OrderObject._hybrid.onMined();
    })
    .then(OrderObject => {
      expect(OrderObject._hybrid.getOriginalTransaction().state()).toBe(TransactionState.mined);
      daiToken = oasisService.get('token').getToken(tokens.DAI);
      return daiToken.approveUnlimited(randomAddress).onMined();
    })
    .then(() => {
      return daiToken.approveUnlimited(randomAddress).onMined();
    })
    .then(() => {
      return daiToken.approveUnlimited(randomAddress).onMined();
    })
    .then(() => {
      return daiToken.approveUnlimited(randomAddress).onMined();
    })
    .then(() => {
      return order.onFinalized();
    })
    .then(OrderObject => {
      expect(OrderObject._hybrid.getOriginalTransaction().state()).toBe(TransactionState.finalized);
      done();
    });
});
*/
