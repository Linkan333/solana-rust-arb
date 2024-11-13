// lib.rs

use anchor_lang::prelude::*;
use anchor_spl::token::{Token};
use solana_program::instruction::Instruction;
use solana_program::program::invoke_signed;
use std::str::FromStr;

declare_id!("497cyv12aNpr31KHVJYbRJot1QhpEiVohb2h4zkb4NZh");

#[program]
pub mod trading_bot {
    use super::*;

    pub fn trade(ctx: Context<Trade>, actions: Vec<TradeAction>, amount: u64) -> Result<()> {
        msg!("Starting transaction for buy/sell actions...");

        // Debug logs to verify data
        msg!("Flashloan Program ID: {:?}", ctx.accounts.flashloan_program.key());
        msg!("Borrower: {:?}", ctx.accounts.borrower.key());
        msg!("Flashloan: {:?}", ctx.accounts.flashloan.key());
        msg!("Amount: {:?}", amount);

        // Execute flashloan logic
        invoke_signed(
            &flashloan_instruction(
                ctx.accounts.flashloan_program.key(),
                ctx.accounts.borrower.key(),
                ctx.accounts.flashloan.key(),
                amount,
            )?,
            &[
                ctx.accounts.flashloan_program.to_account_info(),
                ctx.accounts.borrower.to_account_info(),
                ctx.accounts.flashloan.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            &[&[b"flashloan-seed"]],
        )?;

        // Emit a FlashloanEvent to track the flashloan
        emit!(FlashloanEvent {
            borrower: ctx.accounts.borrower.key(),
            amount,
        });

        // Execute each trade action in sequence
        for action in actions {
            match action {
                TradeAction::Buy => {
                    msg!("Executing buy transaction...");
                    emit!(TradeActionEvent {
                        action_type: "buy".to_string(),
                    });
                }
                TradeAction::Sell => {
                    msg!("Executing sell transaction...");
                    emit!(TradeActionEvent {
                        action_type: "sell".to_string(),
                    });
                }
            }
        }
        msg!("Transaction completed.");
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum TradeAction {
    Buy,
    Sell,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Trade<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: This is a simple account with no need for verification as it’s used only for demonstration.
    pub seller: AccountInfo<'info>,
    /// CHECK: This account is the borrower and is mutable because it handles flashloan logic.
    #[account(mut)]
    pub borrower: AccountInfo<'info>,
    /// CHECK: This account will handle the flashloan.
    #[account(mut)]
    pub flashloan: AccountInfo<'info>,
    /// CHECK: This is the Solend flashloan program.
    #[account(address = Pubkey::from_str("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx").unwrap())]
    pub flashloan_program: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Flashloan instruction construction
fn flashloan_instruction(
    flashloan_program_id: Pubkey,
    borrower: Pubkey,
    flashloan: Pubkey,
    amount: u64,
) -> Result<Instruction> {
    #[derive(AnchorSerialize, AnchorDeserialize)]
    struct FlashLoanInstructionData {
        amount: u64,
    }

    let data = FlashLoanInstructionData { amount }.try_to_vec()?;
    let accounts = vec![
        AccountMeta::new_readonly(borrower, true),
        AccountMeta::new(flashloan, false),
    ];

    Ok(Instruction {
        program_id: flashloan_program_id,
        accounts,
        data,
    })
}

#[event]
pub struct TradeActionEvent {
    pub action_type: String,
}

#[event]
pub struct FlashloanEvent {
    pub borrower: Pubkey,
    pub amount: u64,
}
