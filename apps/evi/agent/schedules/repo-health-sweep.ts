import { defineSchedule } from 'eve/schedules'
import slack from '../channels/slack'
import { maintainerRun } from '../lib/schedule'

export default defineSchedule({
  cron: '0 8 * * 2,5',
  run: maintainerRun(slack, 'Repo health sweep', 'Load the repo-health-sweep skill, read the simplification coverage ledger, choose bounded code, test, architecture, and communication cohorts, then call simplification-sweep once. Verify its confirmed findings against current main. Open at most two ready PRs for mechanical fixes that clear the full readiness gate, request Hugo as reviewer after CI passes, and record proposals, questions, rejected findings, and next cohorts in Linear.'),
})
