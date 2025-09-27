# Sound Files for TeamDock

This directory should contain the following sound files:

- `notification.mp3` - General notification sound
- `join.mp3` - When a member joins the team
- `alert.mp3` - Urgent notifications (voting, etc.)
- `success.mp3` - Successful actions
- `error.mp3` - Error notifications
- `ping.mp3` - Quick message ping
- `whoosh.mp3` - Transition/swipe sound

## How to Generate Sounds

1. Open `generate-sounds.html` in a browser
2. Click each "Generate" button to create WAV files
3. Convert WAV to MP3 using an online converter or ffmpeg:
   ```bash
   ffmpeg -i notification.wav notification.mp3
   ```

## For Development

The app will work without these files but will show console warnings. The sound manager gracefully handles missing files.

## Free Sound Resources

You can get free sounds from:
- https://freesound.org
- https://zapsplat.com
- https://soundbible.com
- https://mixkit.co/free-sound-effects/

## Recommended Sound Characteristics

- **Notification**: Soft, pleasant tone (0.2-0.3s)
- **Join**: Happy, ascending tone (0.3-0.5s)
- **Alert**: Urgent but not jarring (0.3-0.5s)
- **Success**: Positive completion sound (0.2-0.4s)
- **Error**: Low buzz or thud (0.2-0.3s)
- **Ping**: Quick, high-pitched (0.1-0.2s)
- **Whoosh**: Smooth transition (0.2-0.3s)