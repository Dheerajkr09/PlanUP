fetch('https://www.youtube.com/watch?v=hWye_MznAXc')
  .then(r => r.text())
  .then(html => {
    const match = html.match(/"lengthSeconds":"(\d+)"/);
    if (match) {
      console.log("lengthSeconds:", match[1]);
    } else {
      console.log("No lengthSeconds match found.");
      // Check for duration metadata
      const metaMatch = html.match(/<meta itemprop="duration" content="PT(\d+)M(\d+)S">/);
      if (metaMatch) {
        console.log("duration:", parseInt(metaMatch[1]) * 60 + parseInt(metaMatch[2]));
      } else {
        const metaMatchH = html.match(/<meta itemprop="duration" content="PT(\d+)H(\d+)M(\d+)S">/);
        if (metaMatchH) {
           console.log("durationH:", parseInt(metaMatchH[1]) * 3600 + parseInt(metaMatchH[2]) * 60 + parseInt(metaMatchH[3]));
        } else {
           console.log("No metaMatch either");
        }
      }
    }
  })
  .catch(console.error);