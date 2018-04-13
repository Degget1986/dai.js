import EthereumCdpService from '../../src/eth/EthereumCdpService';
import Cdp from '../../src/eth/Cdp';

function buildService() {
  const service = EthereumCdpService.buildTestService();
  return service.manager().authenticate().then(() => service);
}

test('should open a new CDP and return its ID', done => {
  buildService().then(service => {
    const newCdp = new Cdp(service);
    newCdp.getCdpId().then(id => {
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
      done();
    });
  });
});

test('should create a cdp object with an authenticated service and a cdp id', done => {
  const service = EthereumCdpService.buildTestService();
  service.manager().authenticate()
    .then(() => {
      service.openCdp()
      .onMined()
      .then(cdp => {
        expect(cdp).toBeDefined();
        expect(cdp._cdpService).toBeDefined();
        expect(cdp._smartContractService).toBeDefined();
        cdp.getCdpId().then(id => expect(id).toBeGreaterThan(0));
        done();
      });
    });
});

test('should be able to get a CDP\'s info', done => {
  const service = EthereumCdpService.buildTestService();
  service.manager().authenticate()
    .then(() => {
      service.openCdp()
      .onMined()
      .then(cdp => {
        cdp.getInfo().then(info => {
          expect(info).toBeDefined();
          expect(typeof info).toBe('object');
          done();
        });
      });
    });
}, 10000);

test('should be able to close a CDP', done => {
  const service = EthereumCdpService.buildTestService();
  service.manager().authenticate()
    .then(() => service.openCdp().onMined())
    .then(cdp => cdp.shut())
    .then(tx => tx.onMined())
    .then(cdp => cdp.getInfo())
    .then(info => {
        expect(info.lad).toBe('0x0000000000000000000000000000000000000000');
        done();
      });
}, 20000);

test('should have an \'onMined\' event when a user shuts a CDP', done => {
  const service = EthereumCdpService.buildTestService();

  service.manager().authenticate()
    .then(() => {
      service.openCdp()
      .onMined()
      .then(cdp => {
        cdp.shut()
        .then(tx => {
        tx.onMined().then(() => {
          expect(tx._state._state).toBe('mined');
          done();
        });
      });
    });
  });
}, 10000);
