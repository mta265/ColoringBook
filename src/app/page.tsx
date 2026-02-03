'use client'

import { useState, useEffect } from 'react'

// Types
interface Character {
  id: string
  name: string
  description: string
  isDefault: boolean
}

interface Page {
  id: number
  description: string
  dialogue: string[]
  imageUrl?: string
  lineArtUrl?: string
  status: 'pending' | 'generating' | 'done' | 'error'
}

interface Story {
  title: string
  subtitle: string
  pages: Page[]
}

// Default characters (James, Cheetah, Red, Bowie)
const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'james',
    name: 'James',
    description: 'A black and white border collie stuffed animal, loyal and brave, floppy ears',
    isDefault: true,
  },
  {
    id: 'cheetah',
    name: 'Cheetah',
    description: 'A cheetah stuffed animal with yellow fur and black spots, wears cool sunglasses, carries a skateboard, confident attitude',
    isDefault: true,
  },
  {
    id: 'red',
    name: 'Red',
    description: 'A red panda stuffed animal with reddish-brown and white fur, wears a backwards baseball cap, rides a small scooter, friendly grin',
    isDefault: true,
  },
  {
    id: 'bowie',
    name: 'Bowie',
    description: 'A small white poodle stuffed animal with heterochromia (two different colored eyes - one blue, one brown), fluffy curly fur, nervous but sweet',
    isDefault: true,
  },
]

// Style prompt suffix for coloring book aesthetic
const COLORING_BOOK_STYLE = "children's coloring book illustration style, clean bold black outlines, simple shapes, no shading, no color fills, white background, friendly cartoon aesthetic, suitable for kids to color in"

export default function Home() {
  // State
  const [apiKey, setApiKey] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [characters, setCharacters] = useState<Character[]>(DEFAULT_CHARACTERS)
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>(['james', 'cheetah'])
  const [storyPrompt, setStoryPrompt] = useState('')
  const [story, setStory] = useState<Story | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState<'setup' | 'characters' | 'story' | 'generating' | 'preview'>('setup')
  const [error, setError] = useState<string | null>(null)
  
  // New character form
  const [newCharName, setNewCharName] = useState('')
  const [newCharDesc, setNewCharDesc] = useState('')
  const [showNewCharForm, setShowNewCharForm] = useState(false)

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key')
    if (savedKey) {
      setApiKey(savedKey)
      setCurrentStep('characters')
    }
  }, [])

  // Save API key
  const saveApiKey = () => {
    if (apiKeyInput.startsWith('sk-')) {
      localStorage.setItem('openai_api_key', apiKeyInput)
      setApiKey(apiKeyInput)
      setCurrentStep('characters')
      setError(null)
    } else {
      setError('Invalid API key format. It should start with "sk-"')
    }
  }

  // Toggle character selection
  const toggleCharacter = (id: string) => {
    setSelectedCharacters(prev => 
      prev.includes(id) 
        ? prev.filter(c => c !== id)
        : [...prev, id]
    )
  }

  // Add new character
  const addCharacter = () => {
    if (newCharName && newCharDesc) {
      const newChar: Character = {
        id: `custom-${Date.now()}`,
        name: newCharName,
        description: newCharDesc,
        isDefault: false,
      }
      setCharacters(prev => [...prev, newChar])
      setSelectedCharacters(prev => [...prev, newChar.id])
      setNewCharName('')
      setNewCharDesc('')
      setShowNewCharForm(false)
    }
  }

  // Generate story outline using GPT
  const generateStoryOutline = async (): Promise<Page[]> => {
    const selectedChars = characters.filter(c => selectedCharacters.includes(c.id))
    const charDescriptions = selectedChars.map(c => `${c.name}: ${c.description}`).join('\n')
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a children's book author creating a coloring book story. 
            
Given characters and a story idea, create a 6-page story outline. Each page should have:
1. A visual scene description (what to draw - be specific about character poses, setting, action)
2. 1-2 short dialogue lines

Output as JSON array with this format:
[
  {
    "pageNumber": 1,
    "sceneDescription": "detailed visual description for the illustrator",
    "dialogue": ["Character: Line 1", "Character: Line 2"]
  }
]

Keep it fun, age-appropriate for 5-7 year olds, with a simple adventure arc (beginning, challenge, resolution).`
          },
          {
            role: 'user',
            content: `Characters:\n${charDescriptions}\n\nStory idea: ${storyPrompt}\n\nCreate a 6-page coloring book story.`
          }
        ],
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate story outline')
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content
    if (content.includes('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }
    
    const outline = JSON.parse(jsonStr)
    
    return outline.map((page: any, index: number) => ({
      id: index + 1,
      description: page.sceneDescription,
      dialogue: page.dialogue || [],
      status: 'pending' as const,
    }))
  }

  // Generate a single image
  const generateImage = async (page: Page): Promise<string> => {
    const selectedChars = characters.filter(c => selectedCharacters.includes(c.id))
    const charDescriptions = selectedChars.map(c => `${c.name} (${c.description})`).join(', ')
    
    const prompt = `${page.description}

Characters in scene: ${charDescriptions}

Style: ${COLORING_BOOK_STYLE}`

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

  // Main generation flow
  const generateBook = async () => {
    if (selectedCharacters.length === 0) {
      setError('Please select at least one character')
      return
    }
    if (!storyPrompt.trim()) {
      setError('Please describe your story idea')
      return
    }

    setError(null)
    setIsGenerating(true)
    setCurrentStep('generating')

    try {
      // Step 1: Generate story outline
      const pages = await generateStoryOutline()
      
      const newStory: Story = {
        title: 'The Adventures of ' + characters
          .filter(c => selectedCharacters.includes(c.id))
          .map(c => c.name)
          .join(' & '),
        subtitle: storyPrompt,
        pages: pages,
      }
      setStory(newStory)

      // Step 2: Generate images for each page
      for (let i = 0; i < pages.length; i++) {
        setStory(prev => {
          if (!prev) return prev
          const updated = { ...prev }
          updated.pages = [...updated.pages]
          updated.pages[i] = { ...updated.pages[i], status: 'generating' }
          return updated
        })

        try {
          const imageUrl = await generateImage(pages[i])
          
          setStory(prev => {
            if (!prev) return prev
            const updated = { ...prev }
            updated.pages = [...updated.pages]
            updated.pages[i] = { 
              ...updated.pages[i], 
              imageUrl,
              status: 'done' 
            }
            return updated
          })
        } catch (err) {
          console.error(`Error generating page ${i + 1}:`, err)
          setStory(prev => {
            if (!prev) return prev
            const updated = { ...prev }
            updated.pages = [...updated.pages]
            updated.pages[i] = { ...updated.pages[i], status: 'error' }
            return updated
          })
        }

        // Small delay between requests to avoid rate limiting
        if (i < pages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      setCurrentStep('preview')
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setCurrentStep('story')
    } finally {
      setIsGenerating(false)
    }
  }

  // Download as printable HTML
  const downloadBook = () => {
    if (!story) return

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${story.title}</title>
  <style>
    @page { size: letter portrait; margin: 0.5in; }
    body { font-family: Comic Sans MS, cursive, sans-serif; }
    .page { page-break-after: always; text-align: center; padding: 20px; }
    .page:last-child { page-break-after: avoid; }
    .page img { max-width: 100%; max-height: 70vh; border: 2px solid #000; }
    .dialogue { margin-top: 20px; font-size: 18px; }
    .dialogue p { margin: 5px 0; }
    .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 90vh; }
    .cover h1 { font-size: 36px; margin-bottom: 10px; }
    .cover h2 { font-size: 24px; font-weight: normal; color: #666; }
    .page-number { margin-top: 20px; font-size: 14px; color: #999; }
  </style>
</head>
<body>
  <div class="page cover">
    <h1>${story.title}</h1>
    <h2>${story.subtitle}</h2>
    <p style="margin-top: 40px; font-size: 18px;">A Coloring Book Adventure</p>
  </div>
  ${story.pages.map((page, i) => `
  <div class="page">
    ${page.imageUrl ? `<img src="${page.imageUrl}" alt="Page ${i + 1}">` : '<p>[Image not available]</p>'}
    <div class="dialogue">
      ${page.dialogue.map(d => `<p>${d}</p>`).join('')}
    </div>
    <div class="page-number">— ${i + 1} —</div>
  </div>
  `).join('')}
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${story.title.replace(/[^a-z0-9]/gi, '_')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Render
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-2">🎨 Coloring Book Maker</h1>
      <p className="text-center text-gray-600 mb-8">Create custom coloring books for your kids</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Step 1: API Key Setup */}
      {currentStep === 'setup' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Enter Your OpenAI API Key</h2>
          <p className="text-gray-600 mb-4">
            Your API key is stored only in your browser and used to generate images.
            Get one at <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-600 underline">platform.openai.com/api-keys</a>
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
              className="flex-1 border rounded px-3 py-2"
            />
            <button
              onClick={saveApiKey}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Character Selection */}
      {currentStep === 'characters' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Step 2: Choose Your Characters</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {characters.map(char => (
              <div
                key={char.id}
                onClick={() => toggleCharacter(char.id)}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedCharacters.includes(char.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">
                  {char.name === 'James' && '🐕'}
                  {char.name === 'Cheetah' && '🐆'}
                  {char.name === 'Red' && '🦝'}
                  {char.name === 'Bowie' && '🐩'}
                  {!char.isDefault && '⭐'}
                </div>
                <div className="font-semibold">{char.name}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{char.description}</div>
              </div>
            ))}
          </div>

          {/* Add new character */}
          {!showNewCharForm ? (
            <button
              onClick={() => setShowNewCharForm(true)}
              className="text-blue-600 hover:underline mb-6"
            >
              + Add a custom character
            </button>
          ) : (
            <div className="border rounded-lg p-4 mb-6 bg-gray-50">
              <h3 className="font-semibold mb-2">New Character</h3>
              <input
                type="text"
                placeholder="Name (e.g., Whiskers)"
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-2"
              />
              <textarea
                placeholder="Description (e.g., an orange tabby cat with a red bow tie, playful and curious)"
                value={newCharDesc}
                onChange={(e) => setNewCharDesc(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-2 h-20"
              />
              <div className="flex gap-2">
                <button
                  onClick={addCharacter}
                  className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowNewCharForm(false)}
                  className="text-gray-600 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => {
                setApiKey('')
                localStorage.removeItem('openai_api_key')
                setCurrentStep('setup')
              }}
              className="text-gray-600 hover:underline"
            >
              ← Change API Key
            </button>
            <button
              onClick={() => setCurrentStep('story')}
              disabled={selectedCharacters.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
            >
              Next: Story →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Story Input */}
      {currentStep === 'story' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Step 3: Describe Your Adventure</h2>
          
          <div className="mb-4">
            <p className="text-gray-600 mb-2">Selected characters:</p>
            <div className="flex gap-2 flex-wrap">
              {characters
                .filter(c => selectedCharacters.includes(c.id))
                .map(c => (
                  <span key={c.id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {c.name}
                  </span>
                ))}
            </div>
          </div>

          <textarea
            value={storyPrompt}
            onChange={(e) => setStoryPrompt(e.target.value)}
            placeholder="Describe the adventure! For example: James and Cheetah discover a secret treehouse in the park and have to solve puzzles to find the hidden treasure inside."
            className="w-full border rounded px-3 py-2 h-32 mb-4"
          />

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
            <p className="text-sm text-yellow-800">
              💡 <strong>Tip:</strong> Include a challenge or problem for the characters to solve together!
            </p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('characters')}
              className="text-gray-600 hover:underline"
            >
              ← Back to Characters
            </button>
            <button
              onClick={generateBook}
              disabled={!storyPrompt.trim() || isGenerating}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-300"
            >
              🎨 Generate Coloring Book
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Generating */}
      {currentStep === 'generating' && story && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Creating Your Coloring Book...</h2>
          
          <div className="space-y-3">
            {story.pages.map((page, i) => (
              <div key={page.id} className="flex items-center gap-3 p-3 border rounded">
                <div className="w-8 h-8 flex items-center justify-center">
                  {page.status === 'pending' && <span className="text-gray-400">○</span>}
                  {page.status === 'generating' && (
                    <span className="animate-spin">⏳</span>
                  )}
                  {page.status === 'done' && <span className="text-green-600">✓</span>}
                  {page.status === 'error' && <span className="text-red-600">✗</span>}
                </div>
                <div className="flex-1">
                  <div className="font-medium">Page {i + 1}</div>
                  <div className="text-sm text-gray-500 truncate">{page.description}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 mt-6">
            This takes about 1-2 minutes. Each image costs ~$0.04.
          </p>
        </div>
      )}

      {/* Step 5: Preview */}
      {currentStep === 'preview' && story && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{story.title}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStory(null)
                  setStoryPrompt('')
                  setCurrentStep('story')
                }}
                className="text-gray-600 hover:underline"
              >
                ← New Story
              </button>
              <button
                onClick={downloadBook}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                📥 Download for Printing
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {story.pages.map((page, i) => (
              <div key={page.id} className="border rounded overflow-hidden">
                {page.imageUrl ? (
                  <img 
                    src={page.imageUrl} 
                    alt={`Page ${i + 1}`}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">
                    {page.status === 'error' ? 'Error' : 'No image'}
                  </div>
                )}
                <div className="p-2">
                  <div className="font-medium text-sm">Page {i + 1}</div>
                  <div className="text-xs text-gray-500">
                    {page.dialogue.length > 0 && page.dialogue[0]}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">🖨️ Printing Tips</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Click "Download for Printing" to get an HTML file</li>
              <li>• Open the file in your browser and print (Cmd+P / Ctrl+P)</li>
              <li>• Select "Print to PDF" or print directly</li>
              <li>• Use regular paper or thicker cardstock for best coloring</li>
            </ul>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-gray-400 text-sm mt-8">
        Made with ❤️ for Lucas & Ryan
      </p>
    </main>
  )
}
