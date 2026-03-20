import { DomainException } from './domain-exception';

describe('DomainException', () => {
  it('message와 code를 가진다', () => {
    const exception = new DomainException('주문 항목이 없습니다.', 'EMPTY_ITEMS');

    expect(exception.message).toBe('주문 항목이 없습니다.');
    expect(exception.code).toBe('EMPTY_ITEMS');
    expect(exception.name).toBe('DomainException');
  });

  it('Error를 상속한다', () => {
    const exception = new DomainException('test', 'CODE');
    expect(exception).toBeInstanceOf(Error);
  });

  it('스택 트레이스를 포함한다', () => {
    const exception = new DomainException('test', 'CODE');
    expect(exception.stack).toBeDefined();
  });
});
