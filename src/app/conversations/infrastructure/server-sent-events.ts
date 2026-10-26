/**
 * Splits a server-sent event stream into the `data` of each event. Text arrives in arbitrary chunks, so an event
 * cut in two waits for its blank line. Comments, `event:` and `id:` lines are ignored.
 */
export class ServerSentEvents {
  private buffer = '';

  /** @returns the data of every event completed by `chunk`, in order */
  push(chunk: string): string[] {
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    const events = this.buffer.split('\n\n');
    this.buffer = events.pop() ?? '';
    return events.flatMap((event) => {
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''));
      return data.length ? [data.join('\n')] : [];
    });
  }
}
