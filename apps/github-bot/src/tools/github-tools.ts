/**
 * GitHub Tools
 *
 * Tool definitions for the GitHub bot agent
 */

import type { Tool } from '@duyetbot/chat-agent';

/**
 * Tool to post a comment to the current issue or PR
 */
export const postCommentTool: Tool = {
  name: 'post_comment',
  description:
    'Post a comment to the current GitHub issue or pull request. Use this to respond to the user.',
  parameters: {
    type: 'object',
    properties: {
      body: {
        type: 'string',
        description: 'The comment body in GitHub-flavored Markdown',
      },
    },
    required: ['body'],
  },
};

/**
 * Tool to add a reaction to the triggering comment
 */
export const addReactionTool: Tool = {
  name: 'add_reaction',
  description: 'Add a reaction emoji to the comment that triggered this request',
  parameters: {
    type: 'object',
    properties: {
      reaction: {
        type: 'string',
        enum: ['eyes', 'rocket', '+1', '-1', 'heart', 'hooray', 'laugh', 'confused'],
        description: 'The reaction emoji to add',
      },
    },
    required: ['reaction'],
  },
};

/**
 * Tool to get enhanced context about the issue/PR
 */
export const getContextTool: Tool = {
  name: 'get_issue_context',
  description:
    'Get detailed context about the current issue or PR including comments, labels, and for PRs: diff, files, commits, and reviews',
  parameters: {
    type: 'object',
    properties: {},
  },
};

// ============================================
// PR Operation Tools
// ============================================

/**
 * Tool to merge a pull request
 */
export const mergePRTool: Tool = {
  name: 'merge_pr',
  description: 'Merge the current pull request. Will check CI status first. Only works on PRs.',
  parameters: {
    type: 'object',
    properties: {
      merge_method: {
        type: 'string',
        enum: ['merge', 'squash', 'rebase'],
        description: 'The merge method to use (default: squash)',
      },
      commit_title: {
        type: 'string',
        description: 'Optional custom commit title for the merge',
      },
    },
  },
};

/**
 * Tool to approve a pull request
 */
export const approvePRTool: Tool = {
  name: 'approve_pr',
  description: 'Approve the current pull request with an optional comment',
  parameters: {
    type: 'object',
    properties: {
      comment: {
        type: 'string',
        description: 'Optional approval comment',
      },
    },
  },
};

/**
 * Tool to request changes on a pull request
 */
export const requestChangesTool: Tool = {
  name: 'request_changes',
  description: 'Request changes on the current pull request',
  parameters: {
    type: 'object',
    properties: {
      comment: {
        type: 'string',
        description: 'Comment explaining what changes are needed',
      },
    },
    required: ['comment'],
  },
};

/**
 * Tool to check CI/workflow status
 */
export const checkCIStatusTool: Tool = {
  name: 'check_ci_status',
  description: 'Check the CI/workflow status of the current PR or commit',
  parameters: {
    type: 'object',
    properties: {},
  },
};

// ============================================
// Content Tools
// ============================================

/**
 * Tool to get file content from the repository
 */
export const getFileContentTool: Tool = {
  name: 'get_file_content',
  description: 'Get the content of a file from the repository',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path relative to repository root',
      },
      ref: {
        type: 'string',
        description: 'Branch, tag, or commit SHA (default: default branch)',
      },
    },
    required: ['path'],
  },
};

// ============================================
// Task Management Tools
// ============================================

/**
 * Tool to create a new issue
 */
export const createIssueTool: Tool = {
  name: 'create_issue',
  description: 'Create a new issue in the repository',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Issue title',
      },
      body: {
        type: 'string',
        description: 'Issue body in Markdown',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels to add to the issue',
      },
      assignees: {
        type: 'array',
        items: { type: 'string' },
        description: 'GitHub usernames to assign',
      },
    },
    required: ['title'],
  },
};

/**
 * Tool to add labels to an issue/PR
 */
export const addLabelsTool: Tool = {
  name: 'add_labels',
  description: 'Add labels to the current issue or PR',
  parameters: {
    type: 'object',
    properties: {
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels to add',
      },
    },
    required: ['labels'],
  },
};

/**
 * Tool to assign users to an issue/PR
 */
export const assignUsersTool: Tool = {
  name: 'assign_users',
  description: 'Assign users to the current issue or PR',
  parameters: {
    type: 'object',
    properties: {
      assignees: {
        type: 'array',
        items: { type: 'string' },
        description: 'GitHub usernames to assign',
      },
    },
    required: ['assignees'],
  },
};

/**
 * All GitHub tools available to the agent
 */
export const githubTools: Tool[] = [
  // Basic tools
  postCommentTool,
  addReactionTool,
  getContextTool,
  // PR operations
  mergePRTool,
  approvePRTool,
  requestChangesTool,
  checkCIStatusTool,
  // Content tools
  getFileContentTool,
  // Task management
  createIssueTool,
  addLabelsTool,
  assignUsersTool,
];
