// recording-manager.ts
import fs from 'fs';
import prism from 'prism-media';
import { VoiceReceiver, EndBehaviorType } from '@discordjs/voice';

type RecordingSession = {
  stream: NodeJS.WritableStream;
  startAt: number;
};

export class RecordingManager {
  private sessions = new Map<string, RecordingSession>();

  startRecording(receiver: VoiceReceiver, userId: string) {
    if (this.sessions.has(userId)) return;

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      },
    });

    const pcmStream = new prism.opus.Decoder({
      rate: 48000,
      channels: 2,
      frameSize: 960,
    });

    const filePath = `./recordings/${userId}-${Date.now()}.pcm`;
    const output = fs.createWriteStream(filePath);

    opusStream.pipe(pcmStream).pipe(output);

    this.sessions.set(userId, {
      stream: output,
      startAt: Date.now(),
    });

    output.on('finish', () => {
      console.log(`🎙️ ${userId} 녹음 종료`);
      this.sessions.delete(userId);
    });
  }

  stopRecording(userId: string) {
    const session = this.sessions.get(userId);
    if (!session) return;

    session.stream.end();
    this.sessions.delete(userId);
  }

  stopAll() {
    for (const userId of this.sessions.keys()) {
      this.stopRecording(userId);
    }
  }
}
