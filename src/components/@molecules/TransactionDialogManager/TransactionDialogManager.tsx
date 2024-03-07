import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Dispatch, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import usePrevious from 'react-use/lib/usePrevious'
import { useAccount, useChainId } from 'wagmi'

import { Dialog } from '@ensdomains/thorin'

import { transactions } from '@app/transaction-flow/transaction'
import { createPersistConfig } from '@app/utils/query/persist'
import { queryClientWithRefetch } from '@app/utils/query/reactQuery'

import { DataInputComponents } from '../../../transaction-flow/input'
import { InternalTransactionFlow, TransactionFlowAction } from '../../../transaction-flow/types'
import { IntroStageModal } from './stage/Intro'
import { TransactionStageModal } from './stage/TransactionStageModal'

export const useResetSelectedKey = (dispatch: any) => {
  const { address } = useAccount()
  const chainId = useChainId()

  const prevAddress = usePrevious(address)
  const prevChainId = usePrevious(chainId)

  useEffect(() => {
    if (prevChainId && prevChainId !== chainId) {
      dispatch({
        name: 'stopFlow',
      })
    }
  }, [prevChainId, chainId, dispatch])

  useEffect(() => {
    if (prevAddress && prevAddress !== address) {
      dispatch({
        name: 'stopFlow',
      })
    }
  }, [prevAddress, address, dispatch])
}

export const TransactionDialogManager = ({
  state,
  dispatch,
  selectedKey,
}: {
  state: InternalTransactionFlow
  dispatch: Dispatch<TransactionFlowAction>
  selectedKey: string | null
}) => {
  const { t } = useTranslation()
  const selectedItem = useMemo(
    () => (selectedKey ? state.items[selectedKey] : null),
    [selectedKey, state.items],
  )

  useResetSelectedKey(dispatch)

  const onDismiss = useCallback(() => {
    dispatch({ name: 'stopFlow' })
  }, [dispatch])

  const InnerComponent = useMemo(() => {
    if (selectedKey && selectedItem) {
      if (selectedItem.input && selectedItem.currentFlowStage === 'input') {
        const Component = DataInputComponents[selectedItem.input.name]
        return (
          <PersistQueryClientProvider
            client={queryClientWithRefetch}
            persistOptions={createPersistConfig({ queryClient: queryClientWithRefetch })}
          >
            <Component
              {...{
                data: selectedItem.input.data,
                transactions: selectedItem.transactions,
                dispatch,
                onDismiss,
              }}
            />
          </PersistQueryClientProvider>
        )
      }
      if (selectedItem.intro && selectedItem.currentFlowStage === 'intro') {
        const currentTx = selectedItem.transactions[selectedItem.currentTransaction]
        const currentStep =
          currentTx.stage === 'complete'
            ? selectedItem.currentTransaction + 1
            : selectedItem.currentTransaction

        const stepStatus =
          currentTx.stage === 'sent' || currentTx.stage === 'failed' ? 'inProgress' : 'notStarted'

        return (
          <IntroStageModal
            stepStatus={stepStatus}
            currentStep={currentStep}
            onSuccess={() => dispatch({ name: 'setFlowStage', payload: 'transaction' })}
            {...{
              ...selectedItem.intro,
              onDismiss,
              transactions: selectedItem.transactions,
            }}
          />
        )
      }

      const transactionItem = selectedItem.transactions[selectedItem.currentTransaction]
      const transaction = transactions[transactionItem.name]

      return (
        <TransactionStageModal
          actionName={transactionItem.name}
          displayItems={transaction.displayItems(transactionItem.data as any, t)}
          helper={
            'helper' in transaction && typeof transaction.helper === 'function'
              ? transaction.helper(transactionItem.data as any, t)
              : undefined
          }
          currentStep={selectedItem.currentTransaction}
          stepCount={selectedItem.transactions.length}
          transaction={transactionItem}
          txKey={selectedKey}
          backToInput={'backToInput' in transaction ? !!transaction.backToInput : false}
          {...{ dispatch, onDismiss }}
        />
      )
    }
    return null
  }, [selectedKey, selectedItem, onDismiss, dispatch, t])

  const onDismissDialog = useCallback(() => {
    if (selectedItem?.disableBackgroundClick && selectedItem?.currentFlowStage === 'input') return
    dispatch({
      name: 'stopFlow',
    })
  }, [dispatch, selectedItem?.disableBackgroundClick, selectedItem?.currentFlowStage])

  return (
    <Dialog
      variant="blank"
      open={!!state.selectedKey}
      onDismiss={onDismissDialog}
      onClose={onDismiss}
    >
      {InnerComponent}
    </Dialog>
  )
}
