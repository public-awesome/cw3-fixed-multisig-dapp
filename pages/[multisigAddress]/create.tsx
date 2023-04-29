import type { NextPage } from 'next'
import WalletLoader from 'components/WalletLoader'
import { useSigningClient } from 'contexts/cosmwasm'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import LineAlert from 'components/LineAlert'
import cloneDeep from 'lodash.clonedeep'
import { StdFee } from "@cosmjs/stargate";

const defaultFee: StdFee = { amount: [{ amount: "10000", denom: "ustars" },], gas: "500000" };

interface FormElements extends HTMLFormControlsCollection {
  label: HTMLInputElement
  description: HTMLInputElement
  json: HTMLInputElement
}

interface ProposalFormElement extends HTMLFormElement {
  readonly elements: FormElements
}

function validateJsonSendMsg(json: any, multisigAddress: string) {
  if (typeof json !== 'object') {
    return false
  }
  if (!Array.isArray(json)) {
    return false
  }
  return true
}

const ProposalCreate: NextPage = () => {
  const router = useRouter()
  const multisigAddress = (router.query.multisigAddress || '') as string
  const { walletAddress, signingClient } = useSigningClient()
  const [transactionHash, setTransactionHash] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposalID, setProposalID] = useState('')

  const handleSubmit = (event: FormEvent<ProposalFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const currentTarget = event.currentTarget as ProposalFormElement

    const title = currentTarget.label.value.trim()
    const description = currentTarget.description.value.trim()
    const jsonStr = currentTarget.json.value.trim()

    if (
      title.length === 0 ||
      description.length === 0 ||
      jsonStr.length === 0
    ) {
      setLoading(false)
      setError('All fields are required.')
    }

    // clone json string to avoid prototype poisoning
    // https://medium.com/intrinsic-blog/javascript-prototype-poisoning-vulnerabilities-in-the-wild-7bc15347c96
    const jsonClone = cloneDeep(jsonStr)
    let json: any
    try{
      json = JSON.parse(jsonClone)
    } catch(e) {
      setLoading(false)
      setError('Error in JSON message.')
      return
    }

    if (!validateJsonSendMsg(json, multisigAddress)) {
      setLoading(false)
      setError('Error in JSON message.')
      return
    }
    const msgs = json
    
    const msg = {
      title,
      description,
      msgs,
    }

    signingClient
      ?.execute(walletAddress, multisigAddress, { propose: msg }, defaultFee)
      .then((response) => {
        setLoading(false)
        setTransactionHash(response.transactionHash)
        const [{ events }] = response.logs
        const [wasm] = events.filter((e) => e.type === 'wasm')
        const [{ value }] = wasm.attributes.filter(
          (w) => w.key === 'proposal_id'
        )
        setProposalID(value)
      })
      .catch((e) => {
        setLoading(false)
        setError(e.message)
      })
  }

  const complete = transactionHash.length > 0

  return (
    <WalletLoader>
      <div className="flex flex-col w-full">
        <div className="grid bg-base-100 place-items-center">
          <form
            className="text-left container mx-auto max-w-lg"
            onSubmit={handleSubmit}
          >
            <h1 className="text-4xl my-8 text-bold">Create Proposal</h1>
            <label className="block">Title</label>
            <input
              className="input input-bordered rounded box-border p-3 w-full focus:input-primary text-xl"
              name="label"
              readOnly={complete}
            />
            <label className="block mt-4">Description</label>
            <textarea
              className="input input-bordered rounded box-border p-3 h-24 w-full focus:input-primary text-xl"
              name="description"
              readOnly={complete}
            />
            <label className="block mt-4">JSON Message Array</label>
            <textarea
              className="input input-bordered rounded box-border p-3 w-full font-mono h-80 focus:input-primary text-x"
              cols={7}
              name="json"
              readOnly={complete}
              placeholder='[{"bank":{"send":{"to_address":"stars153w5xhuqu3et29lgqk4dsynj6gjn96lr33wx4e","amount":[{"denom":"ustars","amount":"1000000"}]}}}]'
            />
            {!complete && (
              <button
                className={`btn btn-primary text-lg mt-8 ml-auto ${
                  loading ? 'loading' : ''
                }`}
                style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                type="submit"
                disabled={loading}
              >
                Create Proposal
              </button>
            )}
            {error && (
              <div className="mt-8">
                <LineAlert variant="error" msg={error} />
              </div>
            )}

            {proposalID.length > 0 && (
              <div className="mt-8 text-right">
                <LineAlert
                  variant="success"
                  msg={`Success! Transaction Hash: ${transactionHash}`}
                />
                <button
                  className="mt-4 box-border px-4 py-2 btn btn-primary"
                  onClick={(e) => {
                    e.preventDefault()
                    router.push(`/${multisigAddress}/${proposalID}`)
                  }}
                >
                  View Proposal &#8599;
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </WalletLoader>
  )
}

export default ProposalCreate
