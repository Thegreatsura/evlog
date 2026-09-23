import { defineSandbox } from 'eve/sandbox'
import { eviErrors } from './errors'

export default defineSandbox(({ parent }) => {
  if (parent === null) throw eviErrors.CONTENT_PARENT_WORKSPACE_REQUIRED()
  return parent.sandbox
})
