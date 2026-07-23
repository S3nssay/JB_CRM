import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, PhoneIncoming, PhoneOutgoing, Play, Pause, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import type { CommunicationRecord } from '@/hooks/use-communications';

interface CallHistoryItemProps {
  record: CommunicationRecord;
}

export function CallHistoryItem({ record }: CallHistoryItemProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const DirectionIcon = record.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <DirectionIcon className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium">
          {record.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call
        </span>
        {record.duration && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDuration(record.duration)}
          </span>
        )}
        <Badge variant={record.status === 'completed' ? 'default' : 'destructive'} className="text-xs">
          {record.status}
        </Badge>
      </div>

      {record.aiSummary && (
        <p className="text-sm text-muted-foreground pl-6">{record.aiSummary}</p>
      )}

      <div className="flex items-center gap-2 pl-6">
        {record.recordingUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const audio = document.getElementById(`audio-${record.id}`) as HTMLAudioElement;
              if (audio) {
                if (isPlaying) { audio.pause(); } else { audio.play(); }
                setIsPlaying(!isPlaying);
              }
            }}
          >
            {isPlaying ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {isPlaying ? 'Pause' : 'Play Recording'}
          </Button>
        )}
        {record.transcript && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            {showTranscript ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            Transcript
          </Button>
        )}
      </div>

      {record.recordingUrl && (
        <audio
          id={`audio-${record.id}`}
          src={record.recordingUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {showTranscript && record.transcript && (
        <div className="ml-6 p-3 bg-muted rounded-md text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
          {record.transcript}
        </div>
      )}
    </div>
  );
}
