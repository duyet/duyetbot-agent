/**
 * GitHub Operations Module
 *
 * Consolidated GitHub API operations for duyetbot-action.
 * All commit, tag, label, and other GitHub operations are contained here.
 *
 * @module github/operations
 */

export type { BranchResult, CreateBranchOptions } from './branches.js';
// Branch operations
export {
  branchExists,
  compareBranches,
  createBranch,
  deleteBranch,
  getBranch,
  getDefaultBranch,
  listBranches,
  mergeBranch,
} from './branches.js';
export type { CommentOptions, CommentResult, UpdateCommentOptions } from './comments.js';
// Comment operations
export {
  createComment,
  deleteComment,
  findBotComment,
  listComments,
  updateComment,
} from './comments.js';
export type { CommitOptions, CommitResult } from './commits.js';
// Commit operations (git)
export {
  amendCommit,
  cherryPick,
  configureGitUser,
  configureGpgSigning,
  createCommit,
  getChangedFiles,
  getCommit,
  getCommitHistory,
  getCommitSHA,
  getCurrentBranch,
  getHeadSHA,
  hasStagedChanges,
  hasUnstagedChanges,
  hasUntrackedFiles,
  isWorkingDirectoryClean,
  revertCommit,
  stageAll,
  stageFiles,
} from './commits.js';
export type { CreateIssueOptions, IssueResult, UpdateIssueOptions } from './issues.js';
// Issue operations
export {
  closeIssue,
  createIssue,
  getIssue,
  listIssues,
  reopenIssue,
  updateIssue,
} from './issues.js';
// Label operations
export {
  addLabels,
  hasLabel,
  listLabels,
  removeLabel,
  setLabels,
} from './labels.js';
export type { CreatePROptions, MergePROptions, PRResult, UpdatePROptions } from './pulls.js';
// Pull request operations
export {
  createPR,
  createReview,
  getPR,
  listPRs,
  listReviews,
  mergePR,
  requestReview,
  updatePR,
} from './pulls.js';
export type { CheckRun, StatusCheck } from './status.js';
// Status check operations
export {
  createCheckRun,
  createStatus,
  getCombinedStatus,
  listCheckRuns,
  updateCheckRun,
  waitForStatusChecks,
} from './status.js';
export type { CreateTagOptions, TagResult } from './tags.js';
// Tag operations
export {
  createRelease,
  createTag,
  deleteRelease,
  deleteTag,
  getReleaseByTag,
  getTag,
  listReleases,
  listTags,
  updateRelease,
} from './tags.js';
