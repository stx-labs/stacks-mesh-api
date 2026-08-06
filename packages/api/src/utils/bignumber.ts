import BigNumberBase from 'bignumber.js';

/**
 * `BigNumber` with exponential formatting disabled, so `toString()` always renders plain digit
 * strings. Token amounts are arbitrary-precision integers (u128 fungible token amounts can exceed
 * 21 digits — e.g. large AMM LP token burns), and the bignumber.js default switches `toString()`
 * to scientific notation (`-1.339e+21`) past 20 digits, which is invalid in Mesh responses.
 *
 * Always import `BigNumber` from this module instead of `bignumber.js`.
 */
const BigNumber = BigNumberBase.clone({ EXPONENTIAL_AT: 1e9 });
type BigNumber = BigNumberBase;

export { BigNumber };
export default BigNumber;
