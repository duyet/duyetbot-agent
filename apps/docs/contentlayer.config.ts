import { makeSource } from 'contentlayer/source-files'
import { allDocus } from 'fumadocs-mdx/contentlayer/doc'
import mdxOptions from './mdx-options'

export const Doc = allDocus({
  contentDirPath: '../../docs',
  mdxOptions,
})

export default makeSource({
  contentDirPath: '.',
  documentTypes: [Doc],
})