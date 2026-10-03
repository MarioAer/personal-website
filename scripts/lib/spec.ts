const SPEC_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/

/**
 * The specification versions among the filenames in `spec/`, oldest first. A version is the date a
 * file is named by; the last one is the current specification.
 */
export function specVersions(filenames: readonly string[]): string[] {
  const versions: string[] = []
  for (const name of filenames) {
    const match = SPEC_FILE.exec(name)
    if (match?.[1]) versions.push(match[1])
  }
  return versions.sort()
}
