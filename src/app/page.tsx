// Generate a single image
  const generateImage = async (page: Page): Promise<string> => {
    const selectedChars = characters.filter(c => selectedCharacters.includes(c.id))
    const charDescriptions = selectedChars.map(c => `${c.name} (${c.description})`).join(', ')
    
    const prompt = `BLACK AND WHITE COLORING BOOK PAGE. Pure black outlines on white background. No color. No shading. No gray. No gradients. Simple line art for children to color with crayons.

Scene: ${page.description}

Characters (draw as cute stuffed animal toys with simple shapes): ${charDescriptions}

STRICT RULES:
- ONLY black lines on white background
- NO color anywhere
- NO shading or gray tones
- NO text, words, letters, or numbers
- Simple cartoon style suitable for a 5-year-old to color
- White/blank background only`

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        size: '1024x1792',
        quality: 'standard',
        n: 1,
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Failed to generate image')
    }

    const data = await response.json()
    return data.data[0].url
  }
