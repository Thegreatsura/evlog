import { defineSandbox } from 'eve/sandbox'

export default defineSandbox(({ parent }) => {
  if (parent === null) throw new Error('Review agents require a parent workspace.')
  return parent.sandbox
})
